import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { broadcastEvent } from '../services/sse';
import { logAudit } from './auditController';

// Queues
export async function createQueue(req: AuthenticatedRequest, res: Response) {
  try {
    const { 
      project_id, 
      name, 
      priority, 
      concurrency_limit, 
      retry_policy_id,
      rate_limit_per_minute,
      webhook_url,
      shard_count,
      region
    } = req.body;
    const userId = req.user?.userId;

    if (!project_id || !name) {
      return res.status(400).json({ error: 'project_id and name are required' });
    }

    const db = await getDb();

    // Verify project belongs to user's organization
    const project = await db.get(
      `SELECT p.* FROM Projects p 
       JOIN Organizations o ON p.organization_id = o.id 
       WHERE p.id = ? AND o.owner_id = ?`,
      project_id, userId
    );

    if (!project) {
      return res.status(403).json({ error: 'Access denied or project not found' });
    }

    // Check unique constraint manually to return a nice message
    const existingQueue = await db.get('SELECT * FROM Queues WHERE project_id = ? AND name = ?', project_id, name);
    if (existingQueue) {
      return res.status(409).json({ error: `A queue with name '${name}' already exists in this project.` });
    }

    const queueId = uuidv4();
    await db.run(
      `INSERT INTO Queues (id, project_id, name, priority, concurrency_limit, retry_policy_id, paused, rate_limit_per_minute, webhook_url, shard_count, region) 
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      queueId,
      project_id,
      name,
      priority !== undefined ? Number(priority) : 1,
      concurrency_limit !== undefined ? Number(concurrency_limit) : 10,
      retry_policy_id || null,
      rate_limit_per_minute ? Number(rate_limit_per_minute) : null,
      webhook_url || null,
      shard_count ? Number(shard_count) : 1,
      region || null
    );

    await logAudit(
      db,
      userId || 'SYSTEM',
      'CREATE_QUEUE',
      'Queue',
      queueId,
      null,
      JSON.stringify({ name, priority, concurrency_limit }),
      req
    );

    return res.status(201).json({
      id: queueId,
      project_id,
      name,
      priority: priority !== undefined ? Number(priority) : 1,
      concurrency_limit: concurrency_limit !== undefined ? Number(concurrency_limit) : 10,
      retry_policy_id: retry_policy_id || null,
      rate_limit_per_minute: rate_limit_per_minute ? Number(rate_limit_per_minute) : null,
      webhook_url: webhook_url || null,
      shard_count: shard_count ? Number(shard_count) : 1,
      region: region || null,
      paused: false
    });
  } catch (error) {
    console.error('Error creating queue:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getQueues(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { project_id } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    const db = await getDb();

    // Verify project belongs to user
    const project = await db.get(
      `SELECT p.* FROM Projects p 
       JOIN Organizations o ON p.organization_id = o.id 
       WHERE p.id = ? AND o.owner_id = ?`,
      project_id, userId
    );

    if (!project) {
      return res.status(403).json({ error: 'Access denied or project not found' });
    }

    const queues = await db.all('SELECT * FROM Queues WHERE project_id = ?', project_id);
    return res.status(200).json(queues);
  } catch (error) {
    console.error('Error fetching queues:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function toggleQueuePause(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { paused } = req.body; // true = pause, false = resume
    const userId = req.user?.userId;

    if (paused === undefined) {
      return res.status(400).json({ error: 'paused state is required (true or false)' });
    }

    const db = await getDb();

    // Verify user owns the queue
    const queue = await db.get(
      `SELECT q.* FROM Queues q 
       JOIN Projects p ON q.project_id = p.id 
       JOIN Organizations o ON p.organization_id = o.id 
       WHERE q.id = ? AND o.owner_id = ?`,
      id, userId
    );

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found or access denied' });
    }

    const pausedVal = paused ? 1 : 0;
    await db.run('UPDATE Queues SET paused = ? WHERE id = ?', pausedVal, id);

    await logAudit(
      db,
      userId || 'SYSTEM',
      paused ? 'PAUSE_QUEUE' : 'RESUME_QUEUE',
      'Queue',
      id,
      JSON.stringify(queue),
      JSON.stringify({ paused: !!pausedVal }),
      req
    );

    broadcastEvent('queue_updated', { id, paused: !!pausedVal });

    return res.status(200).json({
      id,
      paused: !!pausedVal,
      message: paused ? 'Queue paused successfully' : 'Queue resumed successfully'
    });
  } catch (error) {
    console.error('Error updating queue status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getQueueStatistics(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const db = await getDb();

    // Verify queue belongs to user
    const queue = await db.get(
      `SELECT q.* FROM Queues q 
       JOIN Projects p ON q.project_id = p.id 
       JOIN Organizations o ON p.organization_id = o.id 
       WHERE q.id = ? AND o.owner_id = ?`,
      id, userId
    );

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found or access denied' });
    }

    // Get counts grouped by status
    const statusCounts = await db.all(
      'SELECT status, COUNT(*) as count FROM Jobs WHERE queue_id = ? GROUP BY status',
      id
    );

    const counts = {
      QUEUED: 0,
      SCHEDULED: 0,
      CLAIMED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      DEAD: 0,
      BLOCKED: 0,
      CANCELLED: 0
    };

    statusCounts.forEach((row: { status: string; count: number }) => {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] = row.count;
      }
    });

    // Get average duration of completed runs
    const avgDurationRow = await db.get(
      `SELECT AVG(duration_ms) as avg_duration 
       FROM JobExecutions je 
       JOIN Jobs j ON je.job_id = j.id 
       WHERE j.queue_id = ? AND je.status = 'SUCCESS'`,
      id
    );

    // Get total failures and retries
    const executionsSummary = await db.get(
      `SELECT 
         COUNT(*) as total_runs,
         SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as total_failures
       FROM JobExecutions je
       JOIN Jobs j ON je.job_id = j.id
       WHERE j.queue_id = ?`,
      id
    );

    const stats = {
      jobCounts: counts,
      averageDurationMs: Math.round(avgDurationRow?.avg_duration || 0),
      totalRuns: executionsSummary?.total_runs || 0,
      failureRate: executionsSummary?.total_runs 
        ? ((executionsSummary.total_failures / executionsSummary.total_runs) * 100).toFixed(2) + '%'
        : '0.00%'
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching queue statistics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Retry Policies
export async function getRetryPolicies(req: AuthenticatedRequest, res: Response) {
  try {
    const db = await getDb();
    const policies = await db.all('SELECT * FROM RetryPolicies');
    return res.status(200).json(policies);
  } catch (error) {
    console.error('Error fetching retry policies:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createRetryPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, type, delay_ms, multiplier, max_retries } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    if (!['FIXED', 'LINEAR', 'EXPONENTIAL'].includes(type)) {
      return res.status(400).json({ error: 'type must be FIXED, LINEAR, or EXPONENTIAL' });
    }

    const db = await getDb();
    const id = uuidv4();
    await db.run(
      `INSERT INTO RetryPolicies (id, name, type, delay_ms, multiplier, max_retries) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      name,
      type,
      delay_ms !== undefined ? delay_ms : 5000,
      multiplier !== undefined ? multiplier : 2.0,
      max_retries !== undefined ? max_retries : 3
    );

    return res.status(201).json({
      id,
      name,
      type,
      delay_ms: delay_ms !== undefined ? delay_ms : 5000,
      multiplier: multiplier !== undefined ? multiplier : 2.0,
      max_retries: max_retries !== undefined ? max_retries : 3
    });
  } catch (error) {
    console.error('Error creating retry policy:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Purge all non-active jobs inside a queue
export async function purgeQueue(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const db = await getDb();
    
    // Verify queue belongs to user
    const queue = await db.get(`
      SELECT q.id FROM Queues q
      JOIN Projects p ON q.project_id = p.id
      JOIN Organizations o ON p.organization_id = o.id
      WHERE q.id = ? AND o.owner_id = ?
    `, id, userId);

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found or access denied' });
    }

    // Delete jobs that are NOT currently active (not RUNNING or CLAIMED)
    const result = await db.run('DELETE FROM Jobs WHERE queue_id = ? AND status NOT IN (\'RUNNING\', \'CLAIMED\')', id);
    
    await logAudit(
      db,
      userId || 'SYSTEM',
      'PURGE_QUEUE',
      'Queue',
      id,
      null,
      `Purged jobs count: ${result.changes}`,
      req
    );

    broadcastEvent('job_updated', { queue_id: id, bulk: true });
    return res.status(200).json({ message: `Queue purged successfully. Deleted ${result.changes} inactive jobs.` });
  } catch (error) {
    console.error('Error purging queue:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Batch Pause or Resume all queues owned by the user
export async function toggleAllQueues(req: AuthenticatedRequest, res: Response) {
  try {
    const { paused } = req.body; // true = pause all, false = resume all
    const userId = req.user?.userId;
    const db = await getDb();
    
    const pausedVal = paused ? 1 : 0;
    
    // Get all queue IDs belonging to user
    const userQueues = await db.all(`
      SELECT q.id FROM Queues q
      JOIN Projects p ON q.project_id = p.id
      JOIN Organizations o ON p.organization_id = o.id
      WHERE o.owner_id = ?
    `, userId);

    const isPostgres = process.env.DB_TYPE === 'postgres';
    if (isPostgres) {
      await db.exec('BEGIN;');
    } else {
      await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    }

    try {
      for (const q of userQueues) {
        await db.run('UPDATE Queues SET paused = ? WHERE id = ?', pausedVal, q.id);
        broadcastEvent('queue_updated', { id: q.id, paused: !!pausedVal });
      }
      await db.exec('COMMIT;');
      
      await logAudit(
        db,
        userId || 'SYSTEM',
        paused ? 'BULK_PAUSE_QUEUES' : 'BULK_RESUME_QUEUES',
        'Queue',
        null,
        null,
        `Toggled queues count: ${userQueues.length}`,
        req
      );

      return res.status(200).json({ message: paused ? 'All queues paused successfully' : 'All queues resumed successfully' });
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }
  } catch (error) {
    console.error('Error toggling all queues:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
