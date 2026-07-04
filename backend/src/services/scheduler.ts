import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import cronParser from 'cron-parser';
import { isLeader } from './leaderElection';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(intervalMs = 1000) {
  if (schedulerInterval) return;

  console.log('Background Scheduler service started.');
  
  schedulerInterval = setInterval(async () => {
    // Leader election check: only elected leader scheduler node executes scheduling ticks
    if (!isLeader()) {
      return;
    }

    try {
      const db = await getDb();
      const now = new Date().toISOString();

      // Dialect-friendly transaction beginning
      const isPostgres = process.env.DB_TYPE === 'postgres';
      if (isPostgres) {
        await db.exec('BEGIN;');
      } else {
        await db.exec('BEGIN IMMEDIATE TRANSACTION;');
      }

      try {
        // 1. Process delayed/scheduled jobs that are ready
        const readyScheduledJobs = await db.all(
          `SELECT id FROM Jobs WHERE status = 'SCHEDULED' AND scheduled_for <= ?`,
          now
        );

        for (const job of readyScheduledJobs) {
          await db.run(
            `UPDATE Jobs SET status = 'QUEUED', updated_at = ? WHERE id = ?`,
            now, job.id
          );
          
          await db.run(
            `INSERT INTO JobLogs (id, job_id, message, level) 
             VALUES (?, ?, ?, 'INFO')`,
            uuidv4(), job.id, 'Delayed job transition: SCHEDULED -> QUEUED'
          );
        }

        // 2. Process active recurring cron jobs
        const readyCronTemplates = await db.all(
          `SELECT * FROM ScheduledJobs WHERE active = 1 AND next_run_at <= ?`,
          now
        );

        for (const template of readyCronTemplates) {
          const newJobId = uuidv4();
          
          // Fetch queue max retries to inherit
          const queue = await db.get(
            `SELECT q.*, rp.max_retries 
             FROM Queues q 
             LEFT JOIN RetryPolicies rp ON q.retry_policy_id = rp.id 
             WHERE q.id = ?`,
            template.queue_id
          );
          const maxRetries = queue?.max_retries !== undefined && queue?.max_retries !== null 
            ? queue.max_retries 
            : 3;

          // Spawn new job in the queue
          await db.run(
            `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count) 
             VALUES (?, ?, 'QUEUED', 1, ?, ?, ?, 0)`,
            newJobId,
            template.queue_id,
            template.payload,
            now,
            maxRetries
          );

          await db.run(
            `INSERT INTO JobLogs (id, job_id, message, level) 
             VALUES (?, ?, ?, 'INFO')`,
            uuidv4(), newJobId, `Job spawned from cron schedule: ${template.name}`
          );

          // Calculate next run time
          try {
            const interval = cronParser.parseExpression(template.cron_expression);
            const nextRunAt = interval.next().toDate().toISOString();
            
            await db.run(
              `UPDATE ScheduledJobs SET next_run_at = ? WHERE id = ?`,
              nextRunAt, template.id
            );
          } catch (cronError: any) {
            console.error(`Cron parsing failed for template ${template.id}:`, cronError);
            // Disable recurring cron if expression causes errors
            await db.run(
              `UPDATE ScheduledJobs SET active = 0 WHERE id = ?`,
              template.id
            );
          }
        }

        await db.exec('COMMIT;');
      } catch (txError) {
        await db.exec('ROLLBACK;');
        throw txError;
      }
    } catch (error) {
      console.error('Error running scheduler tick:', error);
    }
  }, intervalMs);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Background Scheduler service stopped.');
  }
}
