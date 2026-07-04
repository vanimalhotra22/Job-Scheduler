import Redis from 'ioredis';

let redisInstance: Redis | null = null;
let isConnected = false;

export function getRedis(): Redis | null {
  if (redisInstance) return redisInstance;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[Redis] REDIS_URL not configured. Running in local fallback mode.');
    return null;
  }

  try {
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true
    });
    
    redisInstance.on('connect', () => {
      isConnected = true;
      console.log('[Redis] Connected to Redis cluster successfully.');
    });

    redisInstance.on('error', (err) => {
      isConnected = false;
      console.warn('[Redis] Connection error or Redis offline. Falling back to local memory services.', err.message);
    });

    redisInstance.connect().catch((err) => {
      isConnected = false;
      console.warn('[Redis] Failed to connect to Redis. Running in local fallback mode.', err.message);
    });

    return redisInstance;
  } catch (err) {
    console.warn('[Redis] Initialization error. Running in local fallback mode.');
    return null;
  }
}

export function isRedisAvailable(): boolean {
  getRedis(); // ensures initialization attempt
  return isConnected && redisInstance !== null;
}
