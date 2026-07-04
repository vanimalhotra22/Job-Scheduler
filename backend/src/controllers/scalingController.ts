import { Request, Response } from 'express';
import { getDb } from '../database/db';
import { checkScaling } from '../services/autoScaler';

export async function getScalingMetrics(req: Request, res: Response) {
  try {
    const db = await getDb();

    const activeWorkers = await db.get(`SELECT COUNT(*) as count FROM Workers WHERE status IN ('ACTIVE', 'IDLE')`);
    const offlineWorkers = await db.get(`SELECT COUNT(*) as count FROM Workers WHERE status = 'OFFLINE'`);
    const totalWorkers = await db.get(`SELECT COUNT(*) as count FROM Workers`);

    const queuedJobs = await db.get(`SELECT COUNT(*) as count FROM Jobs WHERE status = 'QUEUED'`);
    const runningJobs = await db.get(`SELECT COUNT(*) as count FROM Jobs WHERE status IN ('RUNNING', 'CLAIMED')`);
    const failedJobs = await db.get(`SELECT COUNT(*) as count FROM Jobs WHERE status = 'FAILED'`);
    const deadJobs = await db.get(`SELECT COUNT(*) as count FROM Jobs WHERE status = 'DEAD'`);

    // Average throughput: jobs completed in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const recentCompleted = await db.get(
      `SELECT COUNT(*) as count FROM JobExecutions WHERE status = 'SUCCESS' AND start_time >= ?`,
      fiveMinAgo
    );

    const activeCount = Number(activeWorkers?.count) || 0;
    const queuedCount = Number(queuedJobs?.count) || 0;
    const runningCount = Number(runningJobs?.count) || 0;

    // Utilization: running / (workers * theoretical max concurrency per worker)
    const utilizationPercent = activeCount > 0 ? Math.min(100, Math.round((runningCount / (activeCount * 10)) * 100)) : 0;

    return res.status(200).json({
      workers: {
        active: activeCount,
        offline: Number(offlineWorkers?.count) || 0,
        total: Number(totalWorkers?.count) || 0,
        utilizationPercent
      },
      jobs: {
        queued: queuedCount,
        running: runningCount,
        failed: Number(failedJobs?.count) || 0,
        dead: Number(deadJobs?.count) || 0
      },
      throughput: {
        last5MinCompleted: Number(recentCompleted?.count) || 0
      }
    });
  } catch (error: any) {
    console.error('Scaling metrics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getScalingRecommendation(req: Request, res: Response) {
  try {
    const db = await getDb();
    const recommendation = await checkScaling(db);
    return res.status(200).json(recommendation);
  } catch (error: any) {
    console.error('Scaling recommendation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
