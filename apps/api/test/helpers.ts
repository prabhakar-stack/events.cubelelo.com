import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { FastifyInstance } from "fastify";
import type { Repository } from "../src/db/repo";
import { env } from "../src/config/env";
import { SEED_ADMIN_EMAIL, SEED_ADMIN_ID } from "../src/db/seed";

// The dev-login endpoint was removed in the security hardening pass, so tests
// mint HS256 tokens directly with the same semantics it had: a stable `sub`
// per email (the seeded admin's fixed ID, or a generated UUID that /auth/sync
// then adopts as the user's ID).
const subsByEmail = new Map<string, string>([[SEED_ADMIN_EMAIL, SEED_ADMIN_ID]]);

async function signToken(email: string, name?: string): Promise<string> {
  let sub = subsByEmail.get(email);
  if (!sub) {
    sub = randomUUID();
    subsByEmail.set(email, sub);
  }
  const secret = new TextEncoder().encode(env.DEV_AUTH_SECRET);
  return new SignJWT({ email, name: name ?? email.split("@")[0] })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/** Mint a dev bearer token for the given email. */
export async function devToken(
  _app: FastifyInstance,
  email: string,
  name?: string,
): Promise<string> {
  return signToken(email, name);
}

export async function adminToken(app: FastifyInstance): Promise<string> {
  return devToken(app, SEED_ADMIN_EMAIL);
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/**
 * Sync the token's user and mark email + mobile verified (competition
 * registration requires both).
 */
export async function syncVerifiedUser(
  app: FastifyInstance,
  repo: Repository,
  token: string,
): Promise<{ id: string; clId: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/sync",
    headers: bearer(token),
  });
  const user = res.json() as { id: string; clId: string };
  await repo.users.update(user.id, { emailVerified: true, mobileVerified: true });
  return user;
}

/** Mint a dev token (for live-server tests using fetch). */
export async function devTokenHttp(
  _baseUrl: string,
  email: string,
  name?: string,
): Promise<string> {
  return signToken(email, name);
}

/** Dev token + sync over HTTP; returns the token, UUID, and CL ID. */
export async function loginAndSync(
  baseUrl: string,
  email: string,
  name?: string,
): Promise<{ token: string; id: string; clId: string }> {
  const token = await devTokenHttp(baseUrl, email, name);
  const res = await fetch(`${baseUrl}/api/v1/auth/sync`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const user = (await res.json()) as { id: string; clId: string };
  return { token, id: user.id, clId: user.clId };
}
