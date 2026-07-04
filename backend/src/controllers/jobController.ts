import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import cronParser from 'cron-parser';
import { broadcastEvent } from '../services/sse';
import { logAudit } from './auditController';
import { getShardIndex } from '../services/queueSharding';

// Submit Job
export async function createJob(req: AuthenticatedRequest, res: Response) {
  try {
    const { 
      queue_id, 
      payload, 
      priority, 
      delay_ms, 
      scheduled_for, 
      cron, 
      batch, 
      idempotency_key,
      dependency_job_id,
      tags
    } = req.body;
    
    const userId = req.user?.userId;

    if (!queue_id) {
      return res.status(400).json({ error: 'queue_id is required' });
    }

    const db = await getDb();

    // Verify queue belongs to user
    const queue = await db.get(
      `SELECT q.*, rp.max_retries as rp_max_retries 
       FROM Queues q 
       JOIN Projects p ON q.project_id = p.id 
       JOIN Organizations o ON p.organization_id = o.id 
       LEFT JOIN RetryPolicies rp ON q.retry_policy_id = rp.id
       WHERE q.id = ? AND o.owner_id = ?`,
      queue_id, userId
    );

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found or access denied' });
    }

    const maxRetries = queue.rp_max_retries !== undefined && queue.rp_max_retries !== null 
      ? queue.rp_max_retries 
      : 3;

    // Handle Recurring Cron Job
    if (cron) {
      try {
        const interval = cronParser.parseExpression(cron);
        const nextRunAt = interval.next().toDate().toISOString();
        const schedId = uuidv4();
        
        await db.run(
          `INSERT INTO ScheduledJobs (id, queue_id, name, cron_expression, payload, next_run_at, active) 
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          schedId,
          queue_id,
          req.body.name || 'cron-job',
          cron,
          JSON.stringify(payload || {}),
          nextRunAt
        );

        await logAudit(db, userId || 'SYSTEM', 'CREATE_CRON_JOB', 'ScheduledJob', schedId, null, cron, req);

        return res.status(201).json({
          message: 'Recurring cron job registered successfully',
          scheduledJobId: schedId,
          cron_expression: cron,
          next_run_at: nextRunAt
        });
      } catch (err: any) {
        return res.status(400).json({ error: 'Invalid cron expression: ' + err.message });
      }
    }

    // Process Tags
    let tagsStr = '';
    const tagsList: string[] = [];
    if (tags) {
      if (Array.isArray(tags)) {
        tagsList.push(...tags.map(t => t.toString().trim()));
      } else if (typeof tags === 'string') {
        tagsList.push(...tags.split(',').map(t => t.trim()));
      }
      tagsStr = tagsList.join(',');
    }

    // Process Correlation ID
    const correlationId = req.headers['x-correlation-id'] as string || req.body.correlation_id || uuidv4();

    // Handle Batch Job Submission
    if (batch && Array.isArray(batch)) {
      const jobIds: string[] = [];
      
      // Execute in transaction
      await db.exec('BEGIN TRANSACTION;');
      try {
        for (const itemPayload of batch) {
          const jobId = uuidv4();
          const pld = JSON.stringify(itemPayload || {});
          
          let schedTime = new Date().toISOString();
          let initialStatus = 'QUEUED';
          
          if (delay_ms) {
            schedTime = new Date(Date.now() + delay_ms).toISOString();
            initialStatus = 'SCHEDULED';
          } else if (scheduled_for) {
            schedTime = new Date(scheduled_for).toISOString();
            initialStatus = 'SCHEDULED';
          }

          await db.run(
            `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count, tags, version, correlation_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)`,
            jobId,
            queue_id,
            initialStatus,
            priority || 1,
            pld,
            schedTime,
            maxRetries,
            tagsStr || null,
            correlationId
          );
          
          // Write separate tag rows
          for (const tag of tagsList) {
            await db.run('INSERT INTO JobTags (id, job_id, tag) VALUES (?, ?, ?)', uuidv4(), jobId, tag);
          }

          // Log job creation
          await db.run(
            `INSERT INTO JobLogs (id, job_id, message, level) VALUES (?, ?, ?, ?)`,
            uuidv4(), jobId, `Job added to batch execution. Correlation ID: ${correlationId}`, 'INFO'
          );

          jobIds.push(jobId);
        }
        await db.exec('COMMIT;');
        
        await logAudit(db, userId || 'SYSTEM', 'BATCH_CREATE_JOBS', 'Job', null, null, `Batch count: ${batch.length}`, req);
        broadcastEvent('job_updated', { batch: true, queue_id });
        return res.status(201).json({ message: `Batch of ${batch.length} jobs created successfully`, jobIds, correlationId });
      } catch (err: any) {
        await db.exec('ROLLBACK;');
        console.error('Error inserting batch jobs:', err);
        return res.status(500).json({ error: 'Internal error inserting batch' });
      }
    }

    // Handle Single Job Submission
    const jobId = uuidv4();
    const payloadStr = JSON.stringify(payload || {});
    
    let scheduledTime = new Date().toISOString();
    let status = 'QUEUED';
    
    if (dependency_job_id) {
      status = 'BLOCKED';
    } else if (delay_ms) {
      scheduledTime = new Date(Date.now() + delay_ms).toISOString();
      status = 'SCHEDULED';
    } else if (scheduled_for) {
      scheduledTime = new Date(scheduled_for).toISOString();
      status = 'SCHEDULED';
    }

    try {
      await db.run(
        `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count, idempotency_key, dependency_job_id, tags, version, correlation_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?)`,
        jobId,
        queue_id,
        status,
        priority || 1,
        payloadStr,
        scheduledTime,
        maxRetries,
        idempotency_key || null,
        dependency_job_id || null,
        tagsStr || null,
        correlationId
      );
      
      // Write separate tag rows
      for (const tag of tagsList) {
        await db.run('INSERT INTO JobTags (id, job_id, tag) VALUES (?, ?, ?)', uuidv4(), jobId, tag);
      }

      // Log job creation
      await db.run(
        `INSERT INTO JobLogs (id, job_id, message, level) VALUES (?, ?, ?, ?)`,
        uuidv4(), jobId, `Job initialized with status: ${status}. Correlation ID: ${correlationId}`, 'INFO'
      );

      await logAudit(db, userId || 'SYSTEM', 'CREATE_JOB', 'Job', jobId, null, payloadStr, req);
      broadcastEvent('job_updated', { id: jobId, queue_id, status, priority });
      
      return res.status(201).json({
        id: jobId,
        queue_id,
        status,
        priority: priority || 1,
        scheduled_for: scheduledTime,
        max_retries: maxRetries,
        idempotency_key: idempotency_key || null,
        dependency_job_id: dependency_job_id || null,
        tags: tagsList,
        version: 1,
        correlation_id: correlationId
      });
    } catch (err: any) {
      // Check for uniqueness constraint violation for idempotency key
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        // Return the existing job with this key to make it idempotent
        const existingJob = await db.get(
          'SELECT id, status, queue_id FROM Jobs WHERE queue_id = ? AND idempotency_key = ?',
          queue_id, idempotency_key
        );
        return res.status(200).json({
          message: 'Job already submitted (idempotency key matches existing job)',
          id: existingJob.id,
          queue_id: existingJob.queue_id,
          status: existingJob.status,
          idempotent: true
        });
      }
      throw err;
    }
  } catch (error: any) {
    console.error('Error creating job:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}

// Get Jobs List (with filtering and pagination)
export async function getJobs(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { queue_id, status, limit, offset } = req.query;

    const db = await getDb();

    // Base query selects jobs belonging to user's queues
    let query = `
      SELECT j.*, q.name as queue_name 
      FROM Jobs j
      JOIN Queues q ON j.queue_id = q.id
      JOIN Projects p ON q.project_id = p.id
      JOIN Organizations o ON p.organization_id = o.id
      WHERE o.owner_id = ?
    `;
    const params: any[] = [userId];

    if (queue_id) {
      query += ` AND j.queue_id = ?`;
      params.push(queue_id);
    }

    if (status) {
      query += ` AND j.status = ?`;
      params.push(status);
    }

    // Order and pagination
    query += ` ORDER BY j.created_at DESC`;

    const parsedLimit = parseInt(limit as string) || 50;
    const parsedOffset = parseInt(offset as string) || 0;

    query += ` LIMIT ? OFFSET ?`;
    params.push(parsedLimit, parsedOffset);

    const jobs = await db.all(query, params);

    // Map payload from string to JSON
    const parsedJobs = jobs.map(j => ({
      ...j,
      payload: JSON.parse(j.payload || '{}')
    }));

    return res.status(200).json(parsedJobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Advanced Search Endpoint
export async function searchJobs(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { q, status, queue_id, tag, from, to, priority, limit = 50, offset = 0 } = req.query;

    const db = await getDb();

    let sql = `
      SELECT DISTINCT j.*, q.name as queue_name
      FROM Jobs j
      JOIN Queues q ON j.queue_id = q.id
      JOIN Projects p ON q.project_id = p.id
      JOIN Organizations o ON p.organization_id = o.id
      LEFT JOIN JobTags jt ON j.id = jt.job_id
      WHERE o.owner_id = ?
    `;
    const params: any[] = [userId];

    if (q) {
      sql += ' AND (j.payload LIKE ? OR j.id LIKE ? OR j.correlation_id LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (status) {
      sql += ' AND j.status = ?';
      params.push(status);
    }

    if (queue_id) {
      sql += ' AND j.queue_id = ?';
      params.push(queue_id);
    }

    if (tag) {
      sql += ' AND jt.tag = ?';
      params.push(tag);
    }

    if (priority) {
      sql += ' AND j.priority = ?';
      params.push(Number(priority));
    }

    if (from) {
      sql += ' AND j.created_at >= ?';
      params.push(from);
    }

    if (to) {
      sql += ' AND j.created_at <= ?';
      params.push(to);
    }

    sql += ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const jobs = await db.all(sql, params);
    const parsedJobs = jobs.map(j => ({
      ...j,
      payload: JSON.parse(j.payload || '{}')
    }));

    return res.status(200).json(parsedJobs);
  } catch (error: any) {
    console.error('Error executing job search:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export Jobs to CSV
export async function exportJobs(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const db = await getDb();

    const jobs = await db.all(`
      SELECT j.id, q.name as queue_name, j.status, j.priority, j.retry_count, j.max_retries, j.correlation_id, j.created_at
      FROM Jobs j
      JOIN Queues q ON j.queue_id = q.id
      JOIN Projects p ON q.project_id = p.id
      JOIN Organizations o ON p.organization_id = o.id
      WHERE o.owner_id = ?
      ORDER BY j.created_at DESC
    `, userId);

    let csv = 'Job ID,Queue,Status,Priority,Retries,Max Retries,Correlation ID,Created At\n';
    for (const job of jobs) {
      csv += `"${job.id}","${job.queue_name}","${job.status}",${job.priority},${job.retry_count},${job.max_retries},"${job.correlation_id || ''}","${job.created_at}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="jobs_export.csv"');
    return res.status(200).send(csv);
  } catch (error: any) {
    console.error('Error exporting jobs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get Single Job (details, logs, executions)
export async function getJobById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const db = await getDb();

    const job = await db.get(
      `SELECT j.*, q.name as queue_name 
       FROM Jobs j
       JOIN Queues q ON j.queue_id = q.id
       JOIN Projects p ON q.project_id = p.id
       JOIN Organizations o ON p.organization_id = o.id
       WHERE j.id = ? AND o.owner_id = ?`,
      id, userId
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    job.payload = JSON.parse(job.payload || '{}');
    if (job.payload_history) {
      try {
        job.payload_history = JSON.parse(job.payload_history);
      } catch {
        job.payload_history = [];
      }
    } else {
      job.payload_history = [];
    }

    // Get Executions
    const executions = await db.all(
      'SELECT * FROM JobExecutions WHERE job_id = ? ORDER BY start_time DESC',
      id
    );

    // Get Logs
    const logs = await db.all(
      'SELECT * FROM JobLogs WHERE job_id = ? ORDER BY timestamp ASC',
      id
    );

    // Check if it exists in DLQ
    const dlq = await db.get(
      'SELECT * FROM DeadLetterQueue WHERE job_id = ?',
      id
    );

    // Get Tags
    const tags = await db.all('SELECT tag FROM JobTags WHERE job_id = ?', id);
    job.tags = tags.map(t => t.tag);

    return res.status(200).json({
      job,
      executions,
      logs,
      dlq: dlq || null
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Cancel / Delete Job
export async function deleteJob(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const db = await getDb();

    // Verify job belongs to user
    const job = await db.get(
      `SELECT j.* FROM Jobs j
       JOIN Queues q ON j.queue_id = q.id
       JOIN Projects p ON q.project_id = p.id
       JOIN Organizations o ON p.organization_id = o.id
       WHERE j.id = ? AND o.owner_id = ?`,
      id, userId
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    if (job.status === 'RUNNING' || job.status === 'CLAIMED') {
      return res.status(400).json({ error: 'Cannot delete/cancel a job that is currently active or running.' });
    }

    await db.run('DELETE FROM Jobs WHERE id = ?', id);

    await logAudit(db, userId || 'SYSTEM', 'DELETE_JOB', 'Job', id, JSON.stringify(job), null, req);

    return res.status(200).json({ message: 'Job deleted/cancelled successfully' });
  } catch (error) {
    console.error('Error deleting job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Manually Retry Job
export async function retryJob(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const db = await getDb();

    // Verify job belongs to user
    const job = await db.get(
      `SELECT j.* FROM Jobs j
       JOIN Queues q ON j.queue_id = q.id
       JOIN Projects p ON q.project_id = p.id
       JOIN Organizations o ON p.organization_id = o.id
       WHERE j.id = ? AND o.owner_id = ?`,
      id, userId
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    if (job.status !== 'FAILED' && job.status !== 'DEAD') {
      return res.status(400).json({ error: 'Only FAILED or DEAD (DLQ) jobs can be manually retried.' });
    }

    // Increment version history & track payload
    const oldVersion = job.version || 1;
    const newVersion = oldVersion + 1;
    const historyList = job.payload_history ? JSON.parse(job.payload_history) : [];
    historyList.push({
      version: oldVersion,
      payload: job.payload,
      timestamp: new Date().toISOString()
    });

    // Execute update inside transaction
    await db.exec('BEGIN;');
    try {
      // 1. Reset job state to QUEUED, bump version
      await db.run(
        `UPDATE Jobs 
         SET status = 'QUEUED', retry_count = 0, worker_id = NULL, scheduled_for = ?, updated_at = ?, version = ?, payload_history = ? 
         WHERE id = ?`,
        new Date().toISOString(),
        new Date().toISOString(),
        newVersion,
        JSON.stringify(historyList),
        id
      );

      // 2. Remove from DLQ if present
      await db.run('DELETE FROM DeadLetterQueue WHERE job_id = ?', id);

      // 3. Log retry event
      await db.run(
        `INSERT INTO JobLogs (id, job_id, message, level) VALUES (?, ?, ?, ?)`,
        uuidv4(), id, `Job manually queued for retry. Version bumped to ${newVersion}`, 'INFO'
      );

      await db.exec('COMMIT;');
    } catch (transactionError) {
      await db.exec('ROLLBACK;');
      throw transactionError;
    }

    await logAudit(db, userId || 'SYSTEM', 'RETRY_JOB', 'Job', id, JSON.stringify(job), null, req);
    broadcastEvent('job_updated', { id, status: 'QUEUED' });
    return res.status(200).json({ id, status: 'QUEUED', message: 'Job reset and queued for execution.' });
  } catch (error) {
    console.error('Error retrying job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Cancel Job
export async function cancelJob(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const db = await getDb();

    // Verify job belongs to user
    const job = await db.get(
      `SELECT j.* FROM Jobs j
       JOIN Queues q ON j.queue_id = q.id
       JOIN Projects p ON q.project_id = p.id
       JOIN Organizations o ON p.organization_id = o.id
       WHERE j.id = ? AND o.owner_id = ?`,
      id, userId
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found or access denied' });
    }

    if (job.status === 'RUNNING' || job.status === 'CLAIMED' || job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return res.status(400).json({ error: `Cannot cancel a job that is in status: ${job.status}` });
    }

    await db.run(
      `UPDATE Jobs SET status = 'CANCELLED', updated_at = ? WHERE id = ?`,
      new Date().toISOString(),
      id
    );

    await db.run(
      `INSERT INTO JobLogs (id, job_id, message, level) VALUES (?, ?, ?, ?)`,
      uuidv4(), id, 'Job manually cancelled by user', 'WARN'
    );

    await logAudit(db, userId || 'SYSTEM', 'CANCEL_JOB', 'Job', id, JSON.stringify(job), null, req);
    broadcastEvent('job_updated', { id, status: 'CANCELLED' });
    return res.status(200).json({ id, status: 'CANCELLED', message: 'Job cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Bulk Retry All Failed/Dead Jobs
export async function retryAllJobs(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const db = await getDb();
    
    await db.exec('BEGIN;');
    try {
      // Find all FAILED or DEAD jobs belonging to the user
      const failedJobs = await db.all(`
        SELECT j.id, j.version, j.payload_history, j.payload FROM Jobs j
        JOIN Queues q ON j.queue_id = q.id
        JOIN Projects p ON q.project_id = p.id
        JOIN Organizations o ON p.organization_id = o.id
        WHERE o.owner_id = ? AND j.status IN ('FAILED', 'DEAD')
      `, userId);

      for (const job of failedJobs) {
        const oldVersion = job.version || 1;
        const newVersion = oldVersion + 1;
        const historyList = job.payload_history ? JSON.parse(job.payload_history) : [];
        historyList.push({
          version: oldVersion,
          payload: job.payload,
          timestamp: new Date().toISOString()
        });

        await db.run(
          `UPDATE Jobs 
           SET status = 'QUEUED', retry_count = 0, worker_id = NULL, scheduled_for = ?, updated_at = ?, version = ?, payload_history = ? 
           WHERE id = ?`,
          new Date().toISOString(),
          new Date().toISOString(),
          newVersion,
          JSON.stringify(historyList),
          job.id
        );
        await db.run('DELETE FROM DeadLetterQueue WHERE job_id = ?', job.id);
        await db.run(
          `INSERT INTO JobLogs (id, job_id, message, level) VALUES (?, ?, ?, ?)`,
          uuidv4(), job.id, `Job manually queued via bulk retry. Version: ${newVersion}`, 'INFO'
        );
      }
      await db.exec('COMMIT;');
      
      await logAudit(db, userId || 'SYSTEM', 'BULK_RETRY_JOBS', 'Job', null, null, `Retried count: ${failedJobs.length}`, req);
      broadcastEvent('job_updated', { bulk: true });
      return res.status(200).json({ message: `Successfully retried ${failedJobs.length} jobs.` });
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  } catch (error) {
    console.error('Error during bulk retry:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
