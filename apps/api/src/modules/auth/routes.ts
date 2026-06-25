import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { FastifyInstance } from "fastify";
import type { Db } from "../../db/store";
import { nextClId, userByEmail } from "../../db/store";
import type { User } from "../../db/types";
import { env } from "../../config/env";
import { requireAuth } from "../../auth/plugin";
import type { Verifier } from "../../auth/verifier";

export async function registerAuthRoutes(
  app: FastifyInstance,
  db: Db,
  verifier: Verifier,
): Promise<void> {
  // Local dev sign-in — only exposed when Supabase is NOT configured. Mints an
  // HS256 token the dev verifier accepts, reusing the existing sub for a known
  // email (so the seeded admin keeps its role).
  if (verifier.mode === "dev") {
    app.post<{ Body: { email?: string; name?: string } }>(
      "/api/v1/auth/dev-login",
      async (req, reply) => {
        const email = req.body?.email?.trim();
        if (!email) return reply.code(400).send({ error: "missing_email" });
        const existing = userByEmail(db, email);
        const sub = existing?.id ?? randomUUID();
        const name =
          existing?.name ?? req.body?.name?.trim() ?? email.split("@")[0] ?? email;
        const secret = new TextEncoder().encode(env.DEV_AUTH_SECRET);
        const token = await new SignJWT({ email, name })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(sub)
          .setIssuedAt()
          .setExpirationTime("7d")
          .sign(secret);
        return { token };
      },
    );
  }

  // First-login sync: create the user row + assign a CL ID if needed.
  app.post(
    "/api/v1/auth/sync",
    { preHandler: requireAuth },
    async (req): Promise<User> => {
      const claims = req.authClaims!;
      let user = db.users.get(claims.sub);
      if (!user) {
        user = {
          id: claims.sub,
          clId: nextClId(db),
          email: claims.email ?? "",
          name: claims.name ?? claims.email?.split("@")[0] ?? "Cuber",
          role: "user",
          wcaVerified: false,
          accountStage: "active",
          createdAt: new Date().toISOString(),
        };
        db.users.set(user.id, user);
      }
      return user;
    },
  );

  app.get("/api/v1/users/me", { preHandler: requireAuth }, async (req, reply) => {
    const user = db.users.get(req.authClaims!.sub);
    if (!user) return reply.code(404).send({ error: "not_synced" });
    return user;
  });
}
