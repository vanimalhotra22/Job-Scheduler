import { getRedis, isRedisAvailable } from './redis';

export interface QuotaConfig {
  planName: 'FREE' | 'PREMIUM';
  maxJobsPerDay: number;
}

const PLANS: Record<string, QuotaConfig> = {
  FREE: { planName: 'FREE', maxJobsPerDay: 100 },
  PREMIUM: { planName: 'PREMIUM', maxJobsPerDay: 100000 }
};

// In-memory fallback counters
const localQuotaMap = new Map<string, { count: number; date: string }>();

export async function getQuotaConfig(plan: string): Promise<QuotaConfig> {
  return PLANS[plan.toUpperCase()] || PLANS.FREE;
}

export async function checkQuota(projectId: string, plan: string = 'FREE'): Promise<{ allowed: boolean; limit: number; current: number }> {
  const config = await getQuotaConfig(plan);
  const key = `quota:${projectId}:${new Date().toISOString().split('T')[0]}`;
  
  let currentUsage = 0;

  if (isRedisAvailable()) {
    const redis = getRedis();
    if (redis) {
      try {
        const val = await redis.get(key);
        currentUsage = val ? parseInt(val, 10) : 0;
      } catch (err) {
        console.warn('[QuotaService] Redis query failed, using memory fallback.');
        currentUsage = getMemoryUsage(key);
      }
    }
  } else {
    currentUsage = getMemoryUsage(key);
  }

  return {
    allowed: currentUsage < config.maxJobsPerDay,
    limit: config.maxJobsPerDay,
    current: currentUsage
  };
}

export async function incrementUsage(projectId: string): Promise<number> {
  const key = `quota:${projectId}:${new Date().toISOString().split('T')[0]}`;
  
  if (isRedisAvailable()) {
    const redis = getRedis();
    if (redis) {
      try {
        const newVal = await redis.incr(key);
        if (newVal === 1) {
          // Set TTL to expire after 24 hours so it auto cleans up
          await redis.expire(key, 86400);
        }
        return newVal;
      } catch (err) {
        console.warn('[QuotaService] Redis increment failed, using memory fallback.');
      }
    }
  }

  // Memory increment
  const today = new Date().toISOString().split('T')[0];
  const current = localQuotaMap.get(key) || { count: 0, date: today };
  current.count++;
  localQuotaMap.set(key, current);
  return current.count;
}

function getMemoryUsage(key: string): number {
  const today = new Date().toISOString().split('T')[0];
  const usage = localQuotaMap.get(key);
  
  // Clear old keys to avoid memory leaks
  if (usage && usage.date !== today) {
    localQuotaMap.delete(key);
    return 0;
  }
  
  return usage ? usage.count : 0;
}
