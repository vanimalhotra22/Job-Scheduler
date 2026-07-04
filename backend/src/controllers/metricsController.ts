import { Request, Response } from 'express';
import { getDb } from '../database/db';

// Get system-wide job logs
export async function getSystemLogs(req: Request, res: Response) {
  try {
    const { limit, level } = req.query;
    const db = await getDb();

    let query = `
      SELECT jl.*, j.queue_id, q.name as queue_name 
      FROM JobLogs jl
      JOIN Jobs j ON jl.job_id = j.id
      JOIN Queues q ON j.queue_id = q.id
    `;
    const params: any[] = [];

    if (level) {
      query += ` WHERE jl.level = ?`;
      params.push(level);
    }

    query += ` ORDER BY jl.timestamp DESC LIMIT ?`;
    params.push(parseInt(limit as string) || 100);

    const logs = await db.all(query, params);
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get aggregate metrics for the dashboard overview
export async function getSystemMetrics(req: Request, res: Response) {
  try {
    const db = await getDb();

    // 1. Get counts of jobs in each state
    const jobStates = await db.all(`
      SELECT status, COUNT(*) as count 
      FROM Jobs 
      GROUP BY status
    `);
    
    const stateCounts: Record<string, number> = {
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
    jobStates.forEach(row => {
      if (row.status in stateCounts) {
        stateCounts[row.status] = Number(row.count);
      }
    });

    // 2. Active vs Offline workers (using JS cutoff to maintain cross-db compatibility)
    const cutoffTime = new Date(Date.now() - 15000).toISOString();
    const activeWorkers = await db.get(
      `SELECT COUNT(*) as count 
       FROM Workers 
       WHERE status IN ('ACTIVE', 'IDLE') 
         AND last_heartbeat >= ?`,
      cutoffTime
    );

    const totalWorkers = await db.get('SELECT COUNT(*) as count FROM Workers');
    const offlineWorkersCount = Math.max(0, (Number(totalWorkers?.count) || 0) - (Number(activeWorkers?.count) || 0));

    // 3. Execution history in last 1 hour and last 24 hours (Throughput metric)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const jobsHourCount = await db.get(
      `SELECT COUNT(*) as count FROM JobExecutions WHERE start_time >= ?`,
      hourAgo
    );
    const jobsDayCount = await db.get(
      `SELECT COUNT(*) as count FROM JobExecutions WHERE start_time >= ?`,
      dayAgo
    );

    // 4. Average execution duration
    const avgDuration = await db.get(
      `SELECT AVG(duration_ms) as avg_duration 
       FROM JobExecutions 
       WHERE status = 'SUCCESS'`
    );

    // 5. Success vs Failure distribution
    const successFailure = await db.get(`
      SELECT 
        SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failure_count
      FROM JobExecutions
    `);

    // 6. Queue performance (Average queuing delay / latency)
    // Delay = execution start_time - job scheduled_for
    let queueLatency;
    if (process.env.DB_TYPE === 'postgres') {
      queueLatency = await db.get(`
        SELECT AVG(EXTRACT(EPOCH FROM (je.start_time - j.scheduled_for))) as avg_delay_seconds
        FROM JobExecutions je
        JOIN Jobs j ON je.job_id = j.id
        WHERE je.status = 'SUCCESS'
      `);
    } else {
      queueLatency = await db.get(`
        SELECT AVG(strftime('%s', je.start_time) - strftime('%s', j.scheduled_for)) as avg_delay_seconds
        FROM JobExecutions je
        JOIN Jobs j ON je.job_id = j.id
        WHERE je.status = 'SUCCESS'
      `);
    }

    // 7. Get historical data for charts (e.g. jobs executed hourly for last 12 hours)
    const hourlyThroughput = [];
    for (let i = 11; i >= 0; i--) {
      const startHour = new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString();
      const endHour = new Date(Date.now() - i * 60 * 60 * 1000).toISOString();
      
      const countRow = await db.get(
        `SELECT COUNT(*) as count FROM JobExecutions WHERE start_time >= ? AND start_time < ?`,
        startHour, endHour
      );
      
      const hourLabel = new Date(Date.now() - i * 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      hourlyThroughput.push({
        time: hourLabel,
        jobs: Number(countRow?.count) || 0
      });
    }

    return res.status(200).json({
      jobCounts: stateCounts,
      workers: {
        active: Number(activeWorkers?.count) || 0,
        offline: offlineWorkersCount
      },
      throughput: {
        lastHour: Number(jobsHourCount?.count) || 0,
        last24Hours: Number(jobsDayCount?.count) || 0
      },
      averageDurationMs: Math.round(Number(avgDuration?.avg_duration) || 0),
      runs: {
        success: Number(successFailure?.success_count) || 0,
        failure: Number(successFailure?.failure_count) || 0
      },
      averageQueueDelaySec: Math.max(0, Math.round(Number(queueLatency?.avg_delay_seconds) || 0)),
      hourlyThroughput
    });
  } catch (error) {
    console.error('Error compiling system metrics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Expose Prometheus formatted metrics
export async function getPrometheusMetrics(req: Request, res: Response) {
  try {
    const db = await getDb();

    // 1. Get counts
    const completedRow = await db.get("SELECT COUNT(*) as count FROM Jobs WHERE status = 'COMPLETED'");
    const failedRow = await db.get("SELECT COUNT(*) as count FROM JobExecutions WHERE status = 'FAILED'");
    
    // 2. Active workers
    const cutoffTime = new Date(Date.now() - 15000).toISOString();
    const activeWorkers = await db.get(
      `SELECT COUNT(*) as count 
       FROM Workers 
       WHERE status IN ('ACTIVE', 'IDLE') 
         AND last_heartbeat >= ?`,
      cutoffTime
    );

    // 3. Queue Latency
    let queueLatency;
    if (process.env.DB_TYPE === 'postgres') {
      queueLatency = await db.get(`
        SELECT AVG(EXTRACT(EPOCH FROM (je.start_time - j.scheduled_for))) as avg_delay_seconds
        FROM JobExecutions je
        JOIN Jobs j ON je.job_id = j.id
        WHERE je.status = 'SUCCESS'
      `);
    } else {
      queueLatency = await db.get(`
        SELECT AVG(strftime('%s', je.start_time) - strftime('%s', j.scheduled_for)) as avg_delay_seconds
        FROM JobExecutions je
        JOIN Jobs j ON je.job_id = j.id
        WHERE je.status = 'SUCCESS'
      `);
    }

    const completed = Number(completedRow?.count) || 0;
    const failed = Number(failedRow?.count) || 0;
    const workers = Number(activeWorkers?.count) || 0;
    const latency = Math.max(0, Math.round(Number(queueLatency?.avg_delay_seconds) || 0));

    // Format plain text response for Prometheus scraping
    let prometheusText = '';
    
    prometheusText += `# HELP jobs_completed_total Total number of completed background jobs\n`;
    prometheusText += `# TYPE jobs_completed_total counter\n`;
    prometheusText += `jobs_completed_total ${completed}\n\n`;

    prometheusText += `# HELP jobs_failed_total Total number of failed execution attempts\n`;
    prometheusText += `# TYPE jobs_failed_total counter\n`;
    prometheusText += `jobs_failed_total ${failed}\n\n`;

    prometheusText += `# HELP active_workers Number of currently active worker instances\n`;
    prometheusText += `# TYPE active_workers gauge\n`;
    prometheusText += `active_workers ${workers}\n\n`;

    prometheusText += `# HELP queue_latency_seconds Average queue waiting latency in seconds\n`;
    prometheusText += `# TYPE queue_latency_seconds gauge\n`;
    prometheusText += `queue_latency_seconds ${latency}\n`;

    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    return res.status(200).send(prometheusText);
  } catch (error) {
    console.error('Error rendering Prometheus metrics:', error);
    return res.status(500).send('# ERROR: Failed to render metrics');
  }
}

// Kubernetes Health Probes
export async function livenessProbe(req: Request, res: Response) {
  return res.status(200).json({ status: 'UP', message: 'Liveness probe passed.' });
}

export async function readinessProbe(req: Request, res: Response) {
  try {
    const db = await getDb();
    await db.get('SELECT 1;'); // Ping database
    return res.status(200).json({ status: 'UP', database: 'HEALTHY', message: 'Readiness probe passed.' });
  } catch (error: any) {
    console.error('[Readiness] Probe failed database check:', error);
    return res.status(503).json({ status: 'DOWN', database: 'UNHEALTHY', error: error.message });
  }
}
