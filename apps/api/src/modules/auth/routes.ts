import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import type { User } from "../../db/types";
import { env } from "../../config/env";
import { requireAuth } from "../../auth/plugin";
import type { Verifier } from "../../auth/verifier";

export async function registerAuthRoutes(
  app: FastifyInstance,
  repo: Repository,
  verifier: Verifier,
): Promise<void> {
  // Local dev sign-in — never registered in production. In development, works
  // alongside Supabase: the verifier accepts both HS256 dev tokens and real
  // Supabase RS256 tokens so you can use dev-login without clearing .env.
  if (process.env.NODE_ENV !== "production") {
    app.post<{ Body: { email?: string; name?: string } }>(
      "/api/v1/auth/dev-login",
      async (req, reply) => {
        const email = req.body?.email?.trim();
        if (!email) return reply.code(400).send({ error: "missing_email" });
        const existing = await repo.users.findByEmail(email);
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
      let user = await repo.users.findById(claims.sub);
      if (!user) {
        user = {
          id: claims.sub,
          clId: await repo.users.nextClId(),
          email: claims.email ?? "",
          name: claims.name ?? claims.email?.split("@")[0] ?? "Cuber",
          role: "user",
          wcaVerified: false,
          accountStage: "active",
          createdAt: new Date().toISOString(),
        };
        await repo.users.create(user);
      }
      return user;
    },
  );

  app.get("/api/v1/users/me", { preHandler: requireAuth }, async (req, reply) => {
    const user = await repo.users.findById(req.authClaims!.sub);
    if (!user) return reply.code(404).send({ error: "not_synced" });
    return user;
  });

  // Legacy account claim — links a migrated_stub profile to the current Google login.
  // The stub was created by the ETL from the old cubelelo-event database.
  // We copy the stub's CL ID + profile onto the current user, then deactivate the stub.
  app.post<{ Body: { legacyClId?: string; legacyEmail?: string } }>(
    "/api/v1/auth/migrate-claim",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { legacyClId, legacyEmail } = req.body ?? {};
      if (!legacyClId && !legacyEmail) {
        return reply.code(400).send({ error: "provide_legacy_cl_id_or_email" });
      }

      const current = await repo.users.findById(req.authClaims!.sub);
      if (!current) return reply.code(404).send({ error: "not_synced" });

      // Find the stub by old CL ID or email
      const stub = legacyClId
        ? await repo.users.findByClId(legacyClId)
        : await repo.users.findByEmail(legacyEmail!);

      if (!stub) return reply.code(404).send({ error: "legacy_account_not_found" });
      if (stub.accountStage !== "migrated_stub") {
        return reply.code(409).send({ error: "account_already_claimed" });
      }
      if (stub.id === current.id) {
        return reply.code(409).send({ error: "already_same_account" });
      }

      // Claim: copy the stub's CL ID and legacy profile fields onto the current user
      const claimed = await repo.users.update(current.id, {
        clId: stub.clId,
        name: stub.name || current.name,
        gender: stub.gender ?? current.gender,
        dob: stub.dob ?? current.dob,
        city: stub.city ?? current.city,
        state: stub.state ?? current.state,
        country: stub.country ?? current.country,
        wcaId: stub.wcaId ?? current.wcaId,
        wcaVerified: stub.wcaVerified || current.wcaVerified,
      });

      // Deactivate stub so it cannot be claimed again
      await repo.users.update(stub.id, { accountStage: "banned" });

      return claimed;
    },
  );
}
