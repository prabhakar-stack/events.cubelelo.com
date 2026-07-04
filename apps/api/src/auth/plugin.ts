import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@cubers/types";
import type { Repository } from "../db/repo";
import type { AuthClaims, Verifier } from "./verifier";
import { isTokenBlocked } from "../lib/tokenBlocklist";

declare module "fastify" {
  interface FastifyRequest {
    authClaims?: AuthClaims;
  }
}

/**
 * onRequest hook: if a Bearer token is present and valid, attach the claims.
 * Invalid/absent tokens leave `authClaims` undefined — guards enforce access.
 */
export function registerAuth(app: FastifyInstance, verifier: Verifier): void {
  app.decorateRequest("authClaims", undefined);
  app.addHook("onRequest", async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    try {
      const claims = await verifier.verify(header.slice(7));
      if (claims.jti && await isTokenBlocked(claims.jti)) {
        req.log.debug("Token blocklisted (signed out)");
        return;
      }
      req.authClaims = claims;
    } catch (err) {
      req.log.debug({ err }, "JWT verification failed");
    }
  });
}

/** Guard: require a valid token. */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!req.authClaims) {
    await reply.code(401).send({ error: "unauthorized" });
  }
}

/** Guard factory: require the authenticated user to have one of the given roles. */
export function requireRole(repo: Repository, ...roles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.authClaims) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const user = await repo.users.findById(req.authClaims.sub);
    if (!user) { await reply.code(403).send({ error: "forbidden" }); return; }
    // super_admin inherits admin permissions
    const effective = user.role === "super_admin" && roles.includes("admin") ? true : roles.includes(user.role);
    if (!effective) {
      await reply.code(403).send({ error: "forbidden" });
    }
  };
}

/** Attach the resolved user to the request (does not reject if not found). */
export async function resolveUser(
  repo: Repository,
  req: FastifyRequest,
): Promise<import("../db/types").User | null> {
  if (!req.authClaims) return null;
  return repo.users.findById(req.authClaims.sub);
}
