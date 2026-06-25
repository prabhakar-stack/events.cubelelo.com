import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@cubers/types";
import type { Db } from "../db/store";
import type { AuthClaims, Verifier } from "./verifier";

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
      req.authClaims = await verifier.verify(header.slice(7));
    } catch {
      // leave undefined — treated as unauthenticated
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

/** Guard factory: require the authenticated user to have a given role. */
export function requireRole(db: Db, role: UserRole) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.authClaims) {
      await reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const user = db.users.get(req.authClaims.sub);
    if (!user || user.role !== role) {
      await reply.code(403).send({ error: "forbidden" });
    }
  };
}
