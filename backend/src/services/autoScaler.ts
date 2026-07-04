import { DbAdapter } from '../database/db';

export interface ScalingRecommendation {
  shouldScale: boolean;
  action: 'SCALE_UP' | 'SCALE_DOWN' | 'NONE';
  targetReplicaCount: number;
  reason: string;
}

export async function checkScaling(db: DbAdapter): Promise<ScalingRecommendation> {
  try {
    // Count active workers
    const activeWorkersRes = await db.get('SELECT COUNT(*) as count FROM Workers WHERE status = ?', 'ACTIVE');
    const activeWorkers = activeWorkersRes?.count || 1;

    // Count pending/queued jobs
    const pendingJobsRes = await db.get("SELECT COUNT(*) as count FROM Jobs WHERE status = 'QUEUED'");
    const pendingJobs = pendingJobsRes?.count || 0;

    // Count running/claimed jobs
    const runningJobsRes = await db.get("SELECT COUNT(*) as count FROM Jobs WHERE status = 'RUNNING' OR status = 'CLAIMED'");
    const runningJobs = runningJobsRes?.count || 0;

    let targetCount = activeWorkers;
    let action: 'SCALE_UP' | 'SCALE_DOWN' | 'NONE' = 'NONE';
    let shouldScale = false;
    let reason = 'Cluster load is within normal operating limits.';

    if (pendingJobs > activeWorkers * 100) {
      action = 'SCALE_UP';
      shouldScale = true;
      targetCount = Math.min(activeWorkers + Math.ceil(pendingJobs / 100), 20); // Cap at 20 workers
      reason = `Pending jobs (${pendingJobs}) exceed worker threshold (${activeWorkers * 100}). Recommending scale up to speed up queue draining.`;
    } else if (pendingJobs === 0 && runningJobs === 0 && activeWorkers > 2) {
      action = 'SCALE_DOWN';
      shouldScale = true;
      targetCount = Math.max(activeWorkers - 1, 2); // Maintain min 2 workers
      reason = `All queues are empty. Recommending scale down to conserve cluster resources.`;
    }

    return {
      shouldScale,
      action,
      targetReplicaCount: targetCount,
      reason
    };
  } catch (error: any) {
    console.error('[AutoScaler] Error evaluating scaling metrics:', error.message);
    return {
      shouldScale: false,
      action: 'NONE',
      targetReplicaCount: 1,
      reason: 'Failed to retrieve cluster status.'
    };
  }
}
