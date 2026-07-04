import { Request, Response } from 'express';
import { getDb, runInImmediateTransaction } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { handleJobFailure } from '../services/retryEngine';
import { broadcastEvent } from '../services/sse';
import { acquireLock, releaseLock } from '../services/distributedLock';
import { shouldWorkerProcessJob } from '../services/queueSharding';

// Register a new worker instance
export async function registerWorker(req: Request, res: Response) {
  try {
    const { hostname } = req.body;
    if (!hostname) {
      return res.status(400).json({ error: 'hostname is required' });
    }

    const db = await getDb();
    const workerId = uuidv4();

    await db.run(
      `INSERT INTO Workers (id, hostname, status, registered_at, last_heartbeat) 
       VALUES (?, ?, 'IDLE', ?, ?)`,
      workerId,
      hostname,
      new Date().toISOString(),
      new Date().toISOString()
    );

    broadcastEvent('worker_updated', { id: workerId, hostname, status: 'IDLE', last_cpu: 0, last_memory: 0 });

    return res.status(201).json({
      workerId,
      hostname,
      message: 'Worker registered successfully'
    });
  } catch (error) {
    console.error('Error registering worker:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Receive heartbeat metrics from worker
export async function sendHeartbeat(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { cpu_usage, memory_usage } = req.body;

    const db = await getDb();

    // Check if worker exists
    const worker = await db.get('SELECT * FROM Workers WHERE id = ?', id);
    if (!worker) {
      return res.status(404).json({ error: 'Worker not registered or offline' });
    }

    const now = new Date().toISOString();

    // Perform inside transaction to update Worker state and add heartbeat history
    const isPostgres = process.env.DB_TYPE === 'postgres';
    if (isPostgres) {
      await db.exec('BEGIN;');
    } else {
      await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    }

    try {
      await db.run(
        `UPDATE Workers SET last_heartbeat = ?, status = 'IDLE' WHERE id = ?`,
        now, id
      );

      await db.run(
        `INSERT INTO WorkerHeartbeats (id, worker_id, heartbeat_time, cpu_usage, memory_usage) 
         VALUES (?, ?, ?, ?, ?)`,
        uuidv4(), id, now, cpu_usage || 0, memory_usage || 0
      );
      await db.exec('COMMIT;');
      
      broadcastEvent('worker_updated', { id, status: 'IDLE', last_cpu: cpu_usage || 0, last_memory: memory_usage || 0, last_heartbeat: now });
    } catch (txError) {
      await db.exec('ROLLBACK;');
      throw txError;
    }

    return res.status(200).json({ message: 'Heartbeat received' });
  } catch (error) {
    console.error('Error saving worker heartbeat:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Atomically Poll and Claim Jobs
export async function pollJob(req: Request, res: Response) {
  const { id: workerId } = req.params;

  try {
    const claimedJob = await runInImmediateTransaction(async (db) => {
      // 1. Verify worker exists
      const worker = await db.get('SELECT * FROM Workers WHERE id = ?', workerId);
      if (!worker) {
        throw new Error(`Worker registration not found: ${workerId}`);
      }

      const now = new Date().toISOString();
      await db.run('UPDATE Workers SET last_heartbeat = ? WHERE id = ?', now, workerId);

      // 2. Select eligible jobs order by priority and creation date
      const jobs = await db.all(
        `SELECT j.id, j.queue_id, j.payload, j.priority, q.shard_count
         FROM Jobs j
         JOIN Queues q ON j.queue_id = q.id
         WHERE j.status = 'QUEUED'
           AND j.scheduled_for <= ?
           AND q.paused = 0
           AND (
             SELECT COUNT(*) 
             FROM Jobs j2 
             WHERE j2.queue_id = j.queue_id 
               AND j2.status IN ('CLAIMED', 'RUNNING')
           ) < q.concurrency_limit
           AND (
             q.rate_limit_per_minute IS NULL OR
             (
               SELECT COUNT(*) 
               FROM JobExecutions je
               JOIN Jobs j3 ON je.job_id = j3.id
               WHERE j3.queue_id = j.queue_id 
                 AND je.start_time >= ?
             ) < q.rate_limit_per_minute
           )
         ORDER BY q.priority DESC, j.priority DESC, j.created_at ASC
         LIMIT 20`,
        now,
        new Date(Date.now() - 60000).toISOString() // 60 seconds ago timestamp
      );

      if (jobs.length === 0) {
        // No jobs available to execute, worker is IDLE
        await db.run(`UPDATE Workers SET status = 'IDLE' WHERE id = ?`, workerId);
        return null;
      }

      // Filter job by shard matching and distributed locks
      let selectedJob = null;
      for (const job of jobs) {
        const shardCount = job.shard_count || 1;
        // Verify shard ownership
        if (shardCount > 1 && !shouldWorkerProcessJob(workerId, job.id, shardCount)) {
          continue;
        }

        // Try to acquire distributed lock on this specific job claim key
        const lockAcquired = await acquireLock(`claim:${job.id}`, 3000);
        if (lockAcquired) {
          selectedJob = job;
          break;
        }
      }

      if (!selectedJob) {
        await db.run(`UPDATE Workers SET status = 'IDLE' WHERE id = ?`, workerId);
        return null;
      }

      // 3. Transition Job to CLAIMED
      await db.run(
        `UPDATE Jobs SET status = 'CLAIMED', worker_id = ?, updated_at = ? WHERE id = ?`,
        workerId,
        now,
        selectedJob.id
      );

      // Update worker state to ACTIVE
      await db.run(`UPDATE Workers SET status = 'ACTIVE' WHERE id = ?`, workerId);

      // Log the event
      await db.run(
        `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
         VALUES (?, ?, ?, ?, 'INFO')`,
        uuidv4(),
        selectedJob.id,
        workerId,
        `Job claimed by worker: ${workerId}`
      );

      // Release lock since database record is successfully transitioned
      await releaseLock(`claim:${selectedJob.id}`);

      broadcastEvent('job_updated', { id: selectedJob.id, status: 'CLAIMED', worker_id: workerId });
      broadcastEvent('worker_updated', { id: workerId, status: 'ACTIVE' });

      return {
        id: selectedJob.id,
        queue_id: selectedJob.queue_id,
        payload: JSON.parse(selectedJob.payload),
        priority: selectedJob.priority
      };
    });

    if (!claimedJob) {
      return res.status(204).send(); // No Content
    }

    return res.status(200).json(claimedJob);
  } catch (error: any) {
    console.error('Error during job polling:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during poll' });
  }
}

// Mark Job execution as started
export async function startJob(req: Request, res: Response) {
  const { id: workerId, jobId } = req.params;

  try {
    const db = await getDb();
    
    const isPostgres = process.env.DB_TYPE === 'postgres';
    if (isPostgres) {
      await db.exec('BEGIN;');
    } else {
      await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    }

    try {
      // Validate assignment
      const job = await db.get('SELECT * FROM Jobs WHERE id = ? AND worker_id = ?', jobId, workerId);
      if (!job) {
        throw new Error('Job not found or assigned to another worker');
      }

      const now = new Date().toISOString();

      // Transition job to RUNNING
      await db.run(
        `UPDATE Jobs SET status = 'RUNNING', updated_at = ? WHERE id = ?`,
        now, jobId
      );

      // Create Job Execution entry
      const execId = uuidv4();
      await db.run(
        `INSERT INTO JobExecutions (id, job_id, worker_id, start_time, status) 
         VALUES (?, ?, ?, ?, 'RUNNING')`,
        execId, jobId, workerId, now
      );

      await db.run(
        `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
         VALUES (?, ?, ?, 'Job execution started by worker', 'INFO')`,
        uuidv4(), jobId, workerId
      );

      await db.exec('COMMIT;');
      broadcastEvent('job_updated', { id: jobId, status: 'RUNNING', worker_id: workerId });
      broadcastEvent('worker_updated', { id: workerId, status: 'ACTIVE' });
      return res.status(200).json({ message: 'Job started successfully', executionId: execId });
    } catch (txError) {
      await db.exec('ROLLBACK;');
      throw txError;
    }
  } catch (error: any) {
    console.error('Error starting job:', error);
    return res.status(400).json({ error: error.message || 'Error starting job' });
  }
}

// Mark Job execution as completed
export async function completeJob(req: Request, res: Response) {
  const { id: workerId, jobId } = req.params;

  try {
    const db = await getDb();

    const isPostgres = process.env.DB_TYPE === 'postgres';
    if (isPostgres) {
      await db.exec('BEGIN;');
    } else {
      await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    }

    try {
      const job = await db.get('SELECT * FROM Jobs WHERE id = ? AND worker_id = ?', jobId, workerId);
      if (!job) {
        throw new Error('Job not found or assigned to another worker');
      }

      const now = new Date().toISOString();

      // Find active execution
      const execution = await db.get(
        `SELECT * FROM JobExecutions 
         WHERE job_id = ? AND worker_id = ? AND status = 'RUNNING' 
         ORDER BY start_time DESC LIMIT 1`,
        jobId, workerId
      );

      let durationMs = 0;
      if (execution) {
        durationMs = Date.now() - new Date(execution.start_time).getTime();
        await db.run(
          `UPDATE JobExecutions 
           SET end_time = ?, duration_ms = ?, status = 'SUCCESS' 
           WHERE id = ?`,
          now, durationMs, execution.id
        );
      }

      // Transition job to COMPLETED and unassign worker
      await db.run(
        `UPDATE Jobs SET status = 'COMPLETED', worker_id = NULL, updated_at = ? WHERE id = ?`,
        now, jobId
      );

      // Log success
      await db.run(
        `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
         VALUES (?, ?, ?, ?, 'INFO')`,
        uuidv4(),
        jobId,
        workerId,
        `Job completed successfully in ${durationMs}ms`
      );

      // Unblock any child jobs depending on this parent job (DAG Workflow Engine)
      const dependentJobs = await db.all(
        `SELECT id FROM Jobs WHERE dependency_job_id = ? AND status = 'BLOCKED'`,
        jobId
      );

      for (const child of dependentJobs) {
        await db.run(
          `UPDATE Jobs SET status = 'QUEUED', scheduled_for = ?, updated_at = ? WHERE id = ?`,
          now,
          now,
          child.id
        );

        await db.run(
          `INSERT INTO JobLogs (id, job_id, message, level) 
           VALUES (?, ?, ?, 'INFO')`,
          uuidv4(),
          child.id,
          `Dependency unblocked: parent job ${jobId} completed successfully. Status changed from BLOCKED to QUEUED.`
        );
      }

      await db.exec('COMMIT;');
      broadcastEvent('job_updated', { id: jobId, status: 'COMPLETED' });
      broadcastEvent('worker_updated', { id: workerId, status: 'IDLE' });
      return res.status(200).json({ message: 'Job completed successfully' });
    } catch (txError) {
      await db.exec('ROLLBACK;');
      throw txError;
    }
  } catch (error: any) {
    console.error('Error completing job:', error);
    return res.status(400).json({ error: error.message || 'Error completing job' });
  }
}

// Mark Job execution as failed
export async function failJob(req: Request, res: Response) {
  const { id: workerId, jobId } = req.params;
  const { error } = req.body;

  try {
    const db = await getDb();

    const isPostgres = process.env.DB_TYPE === 'postgres';
    if (isPostgres) {
      await db.exec('BEGIN;');
    } else {
      await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    }

    try {
      const job = await db.get('SELECT * FROM Jobs WHERE id = ? AND worker_id = ?', jobId, workerId);
      if (!job) {
        throw new Error('Job not found or assigned to another worker');
      }

      const now = new Date().toISOString();
      const errorMessage = error || 'Unknown failure';

      // Find active execution
      const execution = await db.get(
        `SELECT * FROM JobExecutions 
         WHERE job_id = ? AND worker_id = ? AND status = 'RUNNING' 
         ORDER BY start_time DESC LIMIT 1`,
        jobId, workerId
      );

      let durationMs = 0;
      if (execution) {
        durationMs = Date.now() - new Date(execution.start_time).getTime();
        await db.run(
          `UPDATE JobExecutions 
           SET end_time = ?, duration_ms = ?, status = 'FAILED', error_message = ? 
           WHERE id = ?`,
          now, durationMs, errorMessage, execution.id
        );
      }

      // Handle fail and retry policy routing
      const retryResult = await handleJobFailure(db, jobId, errorMessage, workerId);

      await db.exec('COMMIT;');
      broadcastEvent('job_updated', { id: jobId, status: retryResult.status });
      broadcastEvent('worker_updated', { id: workerId, status: 'IDLE' });
      return res.status(200).json({ message: 'Job failure processed', ...retryResult });
    } catch (txError) {
      await db.exec('ROLLBACK;');
      throw txError;
    }
  } catch (error: any) {
    console.error('Error failing job:', error);
    return res.status(400).json({ error: error.message || 'Error failing job' });
  }
}

// Get registered workers list for dashboard monitoring
export async function getWorkers(req: Request, res: Response) {
  try {
    const db = await getDb();
    
    // Fetch workers along with their latest metrics
    const workers = await db.all(
      `SELECT w.*, 
              (SELECT cpu_usage FROM WorkerHeartbeats WHERE worker_id = w.id ORDER BY heartbeat_time DESC LIMIT 1) as last_cpu,
              (SELECT memory_usage FROM WorkerHeartbeats WHERE worker_id = w.id ORDER BY heartbeat_time DESC LIMIT 1) as last_memory
       FROM Workers w
       ORDER BY w.registered_at DESC`
    );

    return res.status(200).json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
