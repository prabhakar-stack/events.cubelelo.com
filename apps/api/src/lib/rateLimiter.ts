import type { FastifyRequest, FastifyReply } from "fastify";
import { getRedis } from "./redis";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: FastifyRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() ?? req.ip;
  return req.ip;
}

async function checkRedis(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = await getRedis();
  if (!redis) return checkMemory(key, windowMs, maxRequests);

  const windowSec = Math.ceil(windowMs / 1000);
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSec);
  const ttl = await redis.ttl(key);
  const resetAt = Date.now() + ttl * 1000;

  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
    resetAt,
  };
}

function checkMemory(
  key: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = inMemoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests } = config;

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const ip = getClientIp(req);
    const key = `rl:${req.routeOptions.url ?? req.url}:${ip}`;

    const result = await checkRedis(key, windowMs, maxRequests);

    reply.header("X-RateLimit-Limit", maxRequests);
    reply.header("X-RateLimit-Remaining", result.remaining);
    reply.header("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      reply.code(429).send({
        error: "too_many_requests",
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
    }
  };
}

// Presets for common routes
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 20 });
export const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10 });
export const passwordResetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 5 });
