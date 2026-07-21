import { getRedis } from "./redis";

const CACHE_TTL = 60;

export interface CachedLeaderboardEntry {
  id: string;
  userId: string;
  userName?: string;
  userClId?: string;
  ao5Ms: number | null;
  bestSingleMs: number | null;
  rank: number | null;
  flagStatus: string;
}

export async function setLeaderboardCache(roundId: string, board: CachedLeaderboardEntry[]): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.set(`lb:${roundId}`, JSON.stringify(board), "EX", CACHE_TTL);
}

export async function getLeaderboardCache(roundId: string): Promise<CachedLeaderboardEntry[] | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const raw = await redis.get(`lb:${roundId}`);
  if (!raw) return null;
  return JSON.parse(raw);
}
