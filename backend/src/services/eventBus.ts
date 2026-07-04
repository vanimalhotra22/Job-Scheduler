import { getRedis, isRedisAvailable } from './redis';
import Redis from 'ioredis';
import { EventEmitter } from 'events';

const localEmitter = new EventEmitter();
let subRedis: Redis | null = null;

// Allow infinite listeners to avoid memory leak warnings on large dashboard connection counts
localEmitter.setMaxListeners(0);

export async function publish(channel: string, data: any): Promise<void> {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  
  if (isRedisAvailable()) {
    const pubRedis = getRedis();
    if (pubRedis) {
      try {
        await pubRedis.publish(channel, payload);
        return;
      } catch (err) {
        // Fallback silently to local event emitter
      }
    }
  }
  
  localEmitter.emit(channel, data);
}

export async function subscribe(channel: string, callback: (data: any) => void): Promise<void> {
  const localCallback = (data: any) => {
    try {
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        callback(parsed);
      } else {
        callback(data);
      }
    } catch {
      callback(data);
    }
  };

  localEmitter.on(channel, localCallback);

  if (isRedisAvailable()) {
    if (!subRedis) {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        try {
          subRedis = new Redis(redisUrl, {
            maxRetriesPerRequest: null
          });
          
          subRedis.on('message', (chan, msg) => {
            localEmitter.emit(chan, msg);
          });
        } catch (err: any) {
          console.warn('[EventBus] Sub connection error, using local emitter.', err.message);
        }
      }
    }

    if (subRedis) {
      try {
        await subRedis.subscribe(channel);
      } catch (err: any) {
        console.warn('[EventBus] Redis subscribe execution error, using local emitter.', err.message);
      }
    }
  }
}
export function getLocalEmitter(): EventEmitter {
  return localEmitter;
}
