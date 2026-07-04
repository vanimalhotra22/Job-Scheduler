import { getRedis, isRedisAvailable } from './redis';

const memoryLocks = new Map<string, number>();

export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    if (redis) {
      try {
        const result = await redis.set(`lock:${key}`, 'locked', 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch (err) {
        console.warn('[DistributedLock] Redis set error, falling back to memory lock.');
      }
    }
  }

  // Memory Fallback
  const now = Date.now();
  const expiresAt = memoryLocks.get(key);
  if (expiresAt && expiresAt > now) {
    return false;
  }
  memoryLocks.set(key, now + ttlMs);
  return true;
}

export async function releaseLock(key: string): Promise<boolean> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    if (redis) {
      try {
        const result = await redis.del(`lock:${key}`);
        return result > 0;
      } catch (err) {
        console.warn('[DistributedLock] Redis delete error, falling back to memory lock.');
      }
    }
  }

  // Memory Fallback
  return memoryLocks.delete(key);
}

export async function renewLock(key: string, ttlMs: number): Promise<boolean> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    if (redis) {
      try {
        // Lua script to renew lock only if it currently exists
        const luaScript = `
          if redis.call("exists", KEYS[1]) == 1 then
            return redis.call("pexpire", KEYS[1], ARGV[1])
          else
            return 0
          end
        `;
        const result = await redis.eval(luaScript, 1, `lock:${key}`, ttlMs);
        return result === 1;
      } catch (err) {
        console.warn('[DistributedLock] Redis renew error, falling back to memory lock.');
      }
    }
  }

  // Memory Fallback
  const now = Date.now();
  const expiresAt = memoryLocks.get(key);
  if (expiresAt && expiresAt > now) {
    memoryLocks.set(key, now + ttlMs);
    return true;
  }
  return false;
}
