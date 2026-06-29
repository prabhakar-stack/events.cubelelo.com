import { env } from "../config/env";

let redisClient: import("ioredis").default | null = null;

export async function getRedis(): Promise<import("ioredis").default | null> {
  if (!env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  const { default: Redis } = await import("ioredis");
  redisClient = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  redisClient.on("error", (err) => console.error("Redis error:", err.message));
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
