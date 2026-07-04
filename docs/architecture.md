# System Architecture & Lifecycle Workflows

This document explains the high-level system components, state machine transitions, and background loops governing the Distributed Job Scheduler.

---

## 1. High-Level System Architecture

                  ┌──────────────────────────────────────────┐
                  │              React Dashboard             │
                  └────────────────────┬─────────────────────┘
                                       │ WebSocket (Socket.io) / HTTP REST
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │    Express API Servers (Multi-Instance)   │
                  │   - Synced via Redis Event Bus (Pub/Sub)  │
                  └────┬────────────────────────────────┬────┘
                       │                                │
        Reads / Writes │                                │ Leader Lease Locks
                       ▼                                ▼
        ┌──────────────┴──────────────┐   ┌─────────────┴─────────────┐
        │   Database Adapter (DB)     │   │   Redis Lock / Leader     │
        │  ┌───────────────────────┐  │   │  ┌─────────────────────┐  │
        │  │ SQLite DB (Local Dev) │  │   │  │ SETNX Lease locks   │  │
        │  ├───────────────────────┤  │   │  ├─────────────────────┤  │
        │  │ PostgreSQL (Prod HA)  │  │   │  │ Pub/Sub Event Bus   │  │
        │  └───────────────────────┘  │   │  └─────────────────────┘  │
        └──────────────┬──────────────┘   └─────────────┬─────────────┘
                       ▲                                ▲
                       │ HTTP / Websocket Polling       │
                       │ - Partitioned by Region        │
                       │ - Sharded via Consistent Hash  │
                       │                                │
        ┌──────────────┴────────────────────────────────┴─────────────┐
        │                 Decoupled Worker Nodes                      │
        │      Worker 1 (Shard A)    │      Worker 2 (Shard B)        │
        └─────────────────────────────────────────────────────────────┘
```

### Modes of Operation
1. **Local Mode (SQLite & In-Memory Primitives)**: Zero-dependency sandbox mode for development. All processes use SQLite's WAL mode and in-memory variables for locking/leader election.
2. **Distributed Mode (PostgreSQL & Redis Clusters)**: Production mode. Employs Postgres' raw query pool, Redis `SETNX` distributed locks to coordinate worker pools, and Redis Pub/Sub to synchronize live dashboard updates across stateless web nodes.


---

## 2. Job Lifecycle State Machine

A job moves through the following states from submission to completion or permanent failure:

```
    [ User Submission ]
            │
            ▼
     ┌──────────────┐     If delayed
     │  SCHEDULED   ├─────────────────────────┐
     └──────┬───────┘                         │
            │ If immediate                    │
            │                                 │
            ▼                                 ▼
     ┌──────────────┐                  [ Scheduler Loop ]
     │    QUEUED    │◄────────────────────────┘
     └──────┬───────┘
            │
            │ Claimed atomically (BEGIN IMMEDIATE)
            ▼
     ┌──────────────┐
     │   CLAIMED    │
     └──────┬───────┘
            │
            │ Worker triggers start
            ▼
     ┌──────────────┐
     │   RUNNING    │
     └──────┬───┬───┘
            │   │
  Succeeds  │   │  Execution fails
            │   └─────────────────────────────┐
            ▼                                 ▼
     ┌──────────────┐                  [ Retry Policy Engine ]
     │  COMPLETED   │                         │
     └──────────────┘                         ├─────────────────┐
                                              │                 │
                                    Retries   │        Retries  │
                                    available │      exhausted  │
                                              ▼                 ▼
                                       ┌─────────────┐   ┌─────────────┐
                                       │  SCHEDULED  │   │    DEAD     │
                                       │  (Backoff)  │   │    (DLQ)    │
                                       └─────────────┘   └─────────────┘
```

---

## 3. Background Loops Detail

### A. Scheduler Loop (Runs every 1 second)
1. **Delayed Jobs Activation**: 
   Queries the database for jobs with `status = 'SCHEDULED' AND scheduled_for <= NOW()`. It updates their status to `QUEUED` so workers can poll them.
2. **Cron Job Spawning**: 
   Queries `ScheduledJobs` where `active = 1 AND next_run_at <= NOW()`. 
   For each template:
   * It inserts a new concrete job with status `QUEUED` into the designated queue.
   * It calculates the next execution time based on the cron expression and updates `next_run_at`.

### B. Worker Reclaimer Loop (Runs every 5 seconds)
1. **Dead Node Detection**:
   Queries `Workers` where `status IN ('ACTIVE', 'IDLE') AND last_heartbeat < (NOW() - 15 seconds)`.
2. **Offline Transition**:
   Marks the identified workers as `OFFLINE`.
3. **Job Reclaiming**:
   Finds all jobs assigned to the dead worker that are currently `CLAIMED` or `RUNNING`.
   * If the job's `retry_count < max_retries`, it increments the retry count and resets status to `QUEUED` (scheduled for immediate re-execution).
   * If `retry_count >= max_retries`, it marks the job `DEAD` and routes it to the `DeadLetterQueue` (DLQ).
   * It updates the active `JobExecutions` record status to `FAILED`.
   * It logs the worker offline event to `JobLogs`.
