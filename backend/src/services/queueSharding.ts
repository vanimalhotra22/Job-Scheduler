import crypto from 'crypto';

/**
 * Assigns a job ID deterministically to a shard index (0 to shardCount - 1).
 */
export function getShardIndex(jobId: string, shardCount: number): number {
  if (shardCount <= 1) return 0;
  
  // Use MD5 hash of the Job ID for uniform distribution
  const hash = crypto.createHash('md5').update(jobId).digest('hex');
  const num = parseInt(hash.substring(0, 8), 16);
  return num % shardCount;
}

/**
 * Returns whether a worker should claim a specific job based on a consistent hash of the worker ID.
 * This assigns shards to workers in a distributed cluster.
 */
export function shouldWorkerProcessJob(workerId: string, jobId: string, shardCount: number): boolean {
  if (shardCount <= 1) return true;

  const jobShard = getShardIndex(jobId, shardCount);
  
  // Deterministically map workerId to a list of shards it is responsible for
  const workerHash = crypto.createHash('md5').update(workerId).digest('hex');
  const workerNum = parseInt(workerHash.substring(0, 8), 16);
  const workerAssignedShard = workerNum % shardCount;

  return jobShard === workerAssignedShard;
}
