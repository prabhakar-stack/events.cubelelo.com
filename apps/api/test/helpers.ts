import type { FastifyInstance } from "fastify";
import { SEED_ADMIN_EMAIL } from "../src/db/store";

/** Dev-login via inject and return a bearer token. */
export async function devToken(
  app: FastifyInstance,
  email: string,
  name?: string,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/dev-login",
    payload: { email, name },
  });
  return (res.json() as { token: string }).token;
}

export async function adminToken(app: FastifyInstance): Promise<string> {
  return devToken(app, SEED_ADMIN_EMAIL);
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

/** Dev-login over HTTP (for live-server tests using fetch). */
export async function devTokenHttp(
  baseUrl: string,
  email: string,
  name?: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/auth/dev-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  return ((await res.json()) as { token: string }).token;
}

/** Dev-login + sync over HTTP; returns the token and the synced user's CL ID. */
export async function loginAndSync(
  baseUrl: string,
  email: string,
  name?: string,
): Promise<{ token: string; clId: string }> {
  const token = await devTokenHttp(baseUrl, email, name);
  const res = await fetch(`${baseUrl}/api/v1/auth/sync`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const user = (await res.json()) as { clId: string };
  return { token, clId: user.clId };
}
