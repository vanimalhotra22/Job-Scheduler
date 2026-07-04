import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { handleJobFailure } from './retryEngine';

let reclaimerInterval: NodeJS.Timeout | null = null;

export function startReclaimer(intervalMs = 5000) {
  if (reclaimerInterval) return;

  console.log('Background Worker Reclaimer service started.');

  reclaimerInterval = setInterval(async () => {
    try {
      const db = await getDb();
      
      // Calculate cutoff time for heartbeats (15 seconds ago)
      const offlineThreshold = new Date(Date.now() - 15000).toISOString();

      const isPostgres = process.env.DB_TYPE === 'postgres';
      if (isPostgres) {
        await db.exec('BEGIN;');
      } else {
        await db.exec('BEGIN IMMEDIATE TRANSACTION;');
      }

      try {
        // 1. Identify workers that have missed the heartbeat threshold
        const deadWorkers = await db.all(
          `SELECT id, hostname FROM Workers 
           WHERE status IN ('ACTIVE', 'IDLE') 
             AND last_heartbeat < ?`,
          offlineThreshold
        );

        for (const worker of deadWorkers) {
          console.warn(`Worker ${worker.hostname} (${worker.id}) is detected as offline due to missing heartbeat.`);

          // Mark worker as offline
          await db.run(
            `UPDATE Workers SET status = 'OFFLINE' WHERE id = ?`,
            worker.id
          );

          // 2. Identify jobs that were claimed or running under this worker
          const strandedJobs = await db.all(
            `SELECT id, retry_count, max_retries 
             FROM Jobs 
             WHERE worker_id = ? AND status IN ('CLAIMED', 'RUNNING')`,
            worker.id
          );

          for (const job of strandedJobs) {
            const nextRetryCount = job.retry_count + 1;

            if (nextRetryCount <= job.max_retries) {
              // Re-queue the job to let other active workers attempt execution
              await db.run(
                `UPDATE Jobs 
                 SET status = 'QUEUED', worker_id = NULL, retry_count = ?, scheduled_for = ?, updated_at = ? 
                 WHERE id = ?`,
                nextRetryCount,
                new Date().toISOString(),
                new Date().toISOString(),
                job.id
              );

              // Update execution entry to failed
              await db.run(
                `UPDATE JobExecutions 
                 SET end_time = ?, duration_ms = 0, status = 'FAILED', error_message = 'Worker crashed (heartbeat lost)' 
                 WHERE job_id = ? AND worker_id = ? AND status = 'RUNNING'`,
                new Date().toISOString(),
                job.id,
                worker.id
              );

              await db.run(
                `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
                 VALUES (?, ?, ?, ?, 'WARN')`,
                uuidv4(),
                job.id,
                worker.id,
                `Worker crashed. Requeuing job. Attempt #${nextRetryCount} of ${job.max_retries}`
              );
            } else {
              // Mark job as permanently DEAD and move to DLQ
              await db.run(
                `UPDATE Jobs 
                 SET status = 'DEAD', worker_id = NULL, retry_count = ?, updated_at = ? 
                 WHERE id = ?`,
                nextRetryCount,
                new Date().toISOString(),
                job.id
              );

              // Insert to DLQ
              await db.run(
                `INSERT INTO DeadLetterQueue (id, job_id, reason, failed_at, resolved) 
                 VALUES (?, ?, ?, ?, 0)
                 ON CONFLICT(job_id) DO UPDATE SET reason = excluded.reason, failed_at = excluded.failed_at, resolved = 0`,
                uuidv4(),
                job.id,
                'Worker crashed and job maxed out retry attempts',
                new Date().toISOString()
              );

              await db.run(
                `UPDATE JobExecutions 
                 SET end_time = ?, duration_ms = 0, status = 'FAILED', error_message = 'Worker crashed and job reached max retries' 
                 WHERE job_id = ? AND worker_id = ? AND status = 'RUNNING'`,
                new Date().toISOString(),
                job.id,
                worker.id
              );

              await db.run(
                `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
                 VALUES (?, ?, ?, 'Worker offline. Job exceeded max retries. Moved to Dead Letter Queue.', 'ERROR')`,
                uuidv4(),
                job.id,
                worker.id
              );
            }
          }
        }

        // 3. Identify running jobs that have exceeded their execution timeout limit
        const activeRuns = await db.all(
          `SELECT j.id, j.timeout_ms, j.worker_id, je.id as execution_id, je.start_time
           FROM Jobs j
           JOIN JobExecutions je ON je.job_id = j.id
           WHERE j.status = 'RUNNING' 
             AND je.status = 'RUNNING'`
        );

        for (const run of activeRuns) {
          const runTimeMs = Date.now() - new Date(run.start_time).getTime();
          if (runTimeMs > run.timeout_ms) {
            console.warn(`Job ${run.id} assigned to worker ${run.worker_id} exceeded timeout limit (${run.timeout_ms}ms). Aborting.`);

            const nowStr = new Date().toISOString();

            // Mark execution entry as failed in db
            await db.run(
              `UPDATE JobExecutions 
               SET end_time = ?, duration_ms = ?, status = 'FAILED', error_message = 'Job execution timeout exceeded' 
               WHERE id = ?`,
              nowStr,
              runTimeMs,
              run.execution_id
            );

            // Delegate failure retry backoffs & DLQ updates to retryEngine
            await handleJobFailure(db, run.id, 'Job execution timeout exceeded', run.worker_id || 'unknown');
          }
        }

        await db.exec('COMMIT;');
      } catch (txError) {
        await db.exec('ROLLBACK;');
        throw txError;
      }
    } catch (error) {
      console.error('Error running worker reclaimer tick:', error);
    }
  }, intervalMs);
}

export function stopReclaimer() {
  if (reclaimerInterval) {
    clearInterval(reclaimerInterval);
    reclaimerInterval = null;
    console.log('Background Worker Reclaimer service stopped.');
  }
}
