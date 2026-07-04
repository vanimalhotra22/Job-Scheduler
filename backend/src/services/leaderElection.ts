import { getRedis, isRedisAvailable } from './redis';
import { v4 as uuidv4 } from 'uuid';

let isLeaderNode = true; // Default to true for single-node SQLite fallback
let schedulerNodeId = uuidv4();
let electionTimer: NodeJS.Timeout | null = null;

export function isLeader(): boolean {
  return isLeaderNode;
}

export function getSchedulerNodeId(): string {
  return schedulerNodeId;
}

export async function startLeaderElection(): Promise<void> {
  const LEASE_TTL = 5000; // 5 seconds lease
  const RENEW_INTERVAL = 2000; // Renew lease every 2 seconds

  const tick = async () => {
    if (!isRedisAvailable()) {
      isLeaderNode = true;
      scheduleNext();
      return;
    }

    const redis = getRedis();
    if (!redis) {
      isLeaderNode = true;
      scheduleNext();
      return;
    }

    try {
      const lockKey = 'lock:leader:scheduler';
      // Attempt to acquire or renew lease
      if (isLeaderNode) {
        // Renew lease: only update TTL if value matches nodeId
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
          else
            return 0
          end
        `;
        const result = await redis.eval(luaScript, 1, lockKey, schedulerNodeId, LEASE_TTL);
        if (result !== 1) {
          isLeaderNode = false;
          console.log(`[LeaderElection] Failed to renew lease. Stepping down as leader. Node ID: ${schedulerNodeId}`);
        }
      } else {
        // Try to acquire new lease
        const result = await redis.set(lockKey, schedulerNodeId, 'PX', LEASE_TTL, 'NX');
        if (result === 'OK') {
          isLeaderNode = true;
          console.log(`[LeaderElection] Node elected as LEADER. Node ID: ${schedulerNodeId}`);
        }
      }
    } catch (err: any) {
      console.warn('[LeaderElection] Error during leader election tick, keeping status.', err.message);
    }

    scheduleNext();
  };

  const scheduleNext = () => {
    electionTimer = setTimeout(tick, RENEW_INTERVAL);
  };

  // Run immediately and schedule loop
  await tick();
}

export function stopLeaderElection(): void {
  if (electionTimer) {
    clearTimeout(electionTimer);
    electionTimer = null;
  }
}
