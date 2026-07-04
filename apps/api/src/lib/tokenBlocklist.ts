import { getRedis } from "./redis";

const memBlocklist = new Map<string, number>();

export async function blockToken(jti: string, expiresAt: number): Promise<void> {
  const ttlMs = expiresAt * 1000 - Date.now();
  if (ttlMs <= 0) return;

  memBlocklist.set(jti, expiresAt);

  const redis = await getRedis();
  if (redis) {
    await redis.set(`blocked:${jti}`, "1", "EX", Math.ceil(ttlMs / 1000)).catch(() => {});
  }
}

export async function isTokenBlocked(jti: string): Promise<boolean> {
  const memEntry = memBlocklist.get(jti);
  if (memEntry) {
    if (memEntry * 1000 < Date.now()) {
      memBlocklist.delete(jti);
      return false;
    }
    return true;
  }

  const redis = await getRedis();
  if (redis) {
    const val = await redis.get(`blocked:${jti}`).catch(() => null);
    if (val) {
      memBlocklist.set(jti, Math.ceil(Date.now() / 1000) + 3600);
      return true;
    }
  }

  return false;
}
