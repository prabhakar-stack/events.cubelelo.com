import { getRedis } from "./redis";

// Local cache — survives only within this process lifetime
const cache = new Map<string, number>();
const REDIS_PREFIX = "scramble_fetch:";
const TTL_SECONDS = 4 * 60 * 60; // 4 hours

function key(roundId: string, userId: string): string {
  return `${roundId}:${userId}`;
}

export async function recordScrambleFetch(roundId: string, userId: string): Promise<void> {
  const k = key(roundId, userId);
  const now = Date.now();

  // Redis is the primary store — survives server restarts
  const redis = await getRedis();
  if (redis) {
    await redis.set(`${REDIS_PREFIX}${k}`, String(now), "EX", TTL_SECONDS).catch(() => {});
  }

  cache.set(k, now);
}

export async function getScrambleFetchTime(roundId: string, userId: string): Promise<number | undefined> {
  const k = key(roundId, userId);

  const local = cache.get(k);
  if (local) return local;

  // Fall back to Redis — data persists across restarts
  const redis = await getRedis();
  if (redis) {
    const val = await redis.get(`${REDIS_PREFIX}${k}`).catch(() => null);
    if (val) {
      const ts = Number(val);
      cache.set(k, ts);
      return ts;
    }
  }

  return undefined;
}
