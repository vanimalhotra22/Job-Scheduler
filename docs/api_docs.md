# REST API Documentation

This document describes the REST API endpoints exposed by the Distributed Job Scheduler API Server. All endpoints are prefixed with `/api`.

---

## 1. Authentication

### Signup
* **Endpoint**: `POST /api/auth/signup`
* **Request Body**:
  ```json
  {
    "name": "System Admin",
    "email": "admin@scheduler.com",
    "password": "admin123",
    "role": "ADMIN"
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "e2a1b3...",
      "name": "System Admin",
      "email": "admin@scheduler.com",
      "role": "ADMIN"
    }
  }
  ```

### Login
* **Endpoint**: `POST /api/auth/login`
* **Request Body**:
  ```json
  {
    "email": "admin@scheduler.com",
    "password": "admin123"
  }
  ```
* **Success Response (200 OK)**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOi...",
    "user": { ... }
  }
  ```

---

## 2. Organizations & Projects

### Create Organization
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `POST /api/organizations`
* **Request Body**: `{ "name": "Google" }`
* **Success Response (201 Created)**: `{ "id": "uuid", "name": "Google", "owner_id": "user-uuid" }`

### Create Project
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `POST /api/projects`
* **Request Body**:
  ```json
  {
    "organization_id": "org-uuid",
    "name": "Search Engine",
    "description": "Background web crawling"
  }
  ```
* **Success Response (201 Created)**: `{ "id": "proj-uuid", "organization_id": "org-uuid", "name": "Search Engine" }`

---

## 3. Queues & Policies

### Create Queue
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `POST /api/queues`
* **Request Body**:
  ```json
  {
    "project_id": "proj-uuid",
    "name": "email-queue",
    "priority": 3,
    "concurrency_limit": 10,
    "retry_policy_id": "policy-uuid"
  }
  ```
* **Success Response (201 Created)**: `{ "id": "queue-uuid", "name": "email-queue", "paused": false, ... }`

### Pause / Resume Queue
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `PATCH /api/queues/:id/pause`
* **Request Body**: `{ "paused": true }`  // true to pause, false to resume
* **Success Response (200 OK)**: `{ "id": "queue-uuid", "paused": true, "message": "Queue paused successfully" }`

---

## 4. Job Management

### Submit Job
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `POST /api/jobs`
* **Request Body (Immediate)**:
  ```json
  {
    "queue_id": "queue-uuid",
    "payload": { "to": "user@gmail.com", "body": "Welcome" },
    "priority": 2
  }
  ```
* **Request Body (Delayed)**: Add `"delay_ms": 10000` (10s delay).
* **Request Body (Recurring Cron)**: Add `"cron": "*/5 * * * *"` (run every 5 mins).
* **Request Body (Batch)**:
  ```json
  {
    "queue_id": "queue-uuid",
    "batch": [
      { "task": "Import row 1" },
      { "task": "Import row 2" }
    ],
    "priority": 1
  }
  ```
* **Success Response (201 Created)**: `{ "id": "job-uuid", "status": "QUEUED", "scheduled_for": "timestamp" }`

### Manual Retry Failed/Dead Job
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `POST /api/jobs/:id/retry`
* **Success Response (200 OK)**: `{ "id": "job-uuid", "status": "QUEUED", "message": "Job reset and queued for execution." }`

---

## 5. Worker APIs (Internal)

### Register Worker
* **Endpoint**: `POST /api/workers/register`
* **Request Body**: `{ "hostname": "node-us-east-1" }`
* **Success Response (201 Created)**: `{ "workerId": "worker-uuid", "hostname": "node-us-east-1" }`

### Heartbeat
* **Endpoint**: `POST /api/workers/:id/heartbeat`
* **Request Body**: `{ "cpu_usage": 45, "memory_usage": 60 }`
* **Success Response (200 OK)**: `{ "message": "Heartbeat received" }`

### Poll Job (Atomic Claim)
* **Endpoint**: `POST /api/workers/:id/poll`
* **Success Response (200 OK)**:
  ```json
  {
    "id": "job-uuid",
    "queue_id": "queue-uuid",
    "payload": { ... },
    "priority": 3
  }
  ```
  *(Returns `204 No Content` if no claimable job is available)*

---

## 6. Audit Logs
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `GET /api/audit-logs`
* **Query Params**: `action` (optional), `entity_type` (optional), `limit` (default 50), `offset` (default 0)
* **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "audit-uuid",
      "user_id": "user-uuid",
      "action": "CREATE_API_KEY",
      "entity_type": "ApiKey",
      "entity_id": "key-uuid",
      "old_value": null,
      "new_value": "{\"name\":\"Production Key\"}",
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-07-04T12:00:00Z"
    }
  ]
  ```

---

## 7. API Keys
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `POST /api/api-keys`
* **Request Body**:
  ```json
  {
    "name": "Production Deploy Key",
    "project_id": "project-uuid",
    "expires_in_days": 30
  }
  ```
* **Success Response (201 Created)**:
  ```json
  {
    "message": "API Key created successfully. Copy it now, it will not be shown again.",
    "id": "key-uuid",
    "name": "Production Deploy Key",
    "apiKey": "sk_4e2c918a...",
    "expires_at": "2026-08-04T12:00:00Z"
  }
  ```
* **Endpoint**: `GET /api/api-keys?project_id=project-uuid`
* **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "key-uuid",
      "name": "Production Deploy Key",
      "expires_at": "2026-08-04T12:00:00Z",
      "created_at": "2026-07-04T12:00:00Z"
    }
  ]
  ```
* **Endpoint**: `DELETE /api/api-keys/:id`
* **Success Response (200 OK)**: `{ "message": "API Key revoked successfully" }`

---

## 8. AI Operations
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `POST /api/ai/failure-analysis`
* **Request Body**: `{ "error_message": "ETIMEDOUT: Connection lost to DB", "payload": { "db": "users" } }`
* **Success Response (200 OK)**:
  ```json
  {
    "category": "DATABASE_ERROR",
    "severity": "CRITICAL",
    "summary": "Database Connection Timeout",
    "explanation": "The worker lost connection to the database while attempting to run.",
    "recommendation": "Check database server load, optimize open connection pools, and verify network rules."
  }
  ```
* **Endpoint**: `POST /api/ai/retry-recommendation`
* **Request Body**: `{ "error_message": "HTTP 429: Too Many Requests", "retry_count": 2 }`
* **Success Response (200 OK)**:
  ```json
  {
    "recommended_delay_ms": 32000,
    "message": "Recommended backoff delay of 32.0 seconds. Identified rate limit response. Standard exponential backoff recommended."
  }
  ```
* **Endpoint**: `GET /api/ai/queue-prediction/:queueId`
* **Success Response (200 OK)**:
  ```json
  [
    { "hour": "13:00", "predicted_job_count": 450 },
    { "hour": "14:00", "predicted_job_count": 520 }
  ]
  ```
* **Endpoint**: `POST /api/ai/log-search`
* **Request Body**: `{ "query": "find 10 failed email logs" }`
* **Success Response (200 OK)**:
  ```json
  {
    "query": "find 10 failed email logs",
    "filtersApplied": { "status": "FAILED", "limit": 10 },
    "results": [ ... ]
  }
  ```

---

## 9. Auto-Scaler & Cluster Health
* **Headers**: `Authorization: Bearer <token>`
* **Endpoint**: `GET /api/scaling/metrics`
* **Success Response (200 OK)**:
  ```json
  {
    "workers": {
      "active": 3,
      "offline": 0,
      "total": 3,
      "utilizationPercent": 40
    },
    "jobs": {
      "queued": 12,
      "running": 4,
      "failed": 2,
      "dead": 1
    },
    "throughput": {
      "last5MinCompleted": 120
    }
  }
  ```
* **Endpoint**: `GET /api/scaling/recommendation`
* **Success Response (200 OK)**:
  ```json
  {
    "shouldScale": true,
    "action": "SCALE_UP",
    "targetReplicaCount": 5,
    "reason": "Pending jobs (120) exceed worker threshold. Recommending scale up."
  }
  ```

