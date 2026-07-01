import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import type { Repository } from "../../db/repo";
import type { User } from "../../db/types";
import { env } from "../../config/env";
import { requireAuth } from "../../auth/plugin";
import type { Verifier } from "../../auth/verifier";
import { emailService, verificationEmail, passwordResetEmail } from "../../lib/email";
import { authLimiter, loginLimiter, passwordResetLimiter } from "../../lib/rateLimiter";

// In-memory token store — swap for Redis/DB in production
const emailTokens = new Map<string, { userId: string; type: "verify" | "reset"; expiresAt: number }>();

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
      if (!user && claims.email) {
        user = await repo.users.findByEmail(claims.email);
      }
      if (!user) {
        user = {
          id: claims.sub,
          clId: await repo.users.nextClId(),
          email: claims.email ?? "",
          name: claims.name ?? claims.email?.split("@")[0] ?? "Cuber",
          role: "user",
          wcaVerified: false,
          emailVerified: true,
          profilePrivacy: "public",
          accountStage: "active",
          createdAt: new Date().toISOString(),
        } satisfies User;
        await repo.users.create(user);
      }
      return user!;
    },
  );

  app.get("/api/v1/users/me", { preHandler: requireAuth }, async (req, reply) => {
    const user = await repo.users.findById(req.authClaims!.sub);
    if (!user) return reply.code(404).send({ error: "not_synced" });
    return user;
  });

  // Email + password registration
  app.post<{ Body: { email?: string; password?: string; name?: string } }>(
    "/api/v1/auth/register",
    { preHandler: authLimiter },
    async (req, reply) => {
      const email = req.body?.email?.trim().toLowerCase();
      const password = req.body?.password;
      const name = req.body?.name?.trim();
      if (!email || !password) {
        return reply.code(400).send({ error: "email_and_password_required" });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: "password_too_short" });
      }
      const existing = await repo.users.findByEmail(email);
      if (existing) {
        return reply.code(409).send({ error: "email_already_registered" });
      }
      const id = randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const user: User = {
        id,
        clId: await repo.users.nextClId(),
        email,
        name: name || email.split("@")[0] || email,
        passwordHash,
        role: "user",
        wcaVerified: false,
        emailVerified: false,
        profilePrivacy: "public",
        accountStage: "active",
        createdAt: new Date().toISOString(),
      };
      await repo.users.create(user);

      // Send verification email
      const verifyToken = randomUUID();
      emailTokens.set(verifyToken, { userId: id, type: "verify", expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      const ve = verificationEmail(user.name, verifyToken);
      await emailService.send({ to: email, subject: ve.subject, html: ve.html });

      const secret = new TextEncoder().encode(env.DEV_AUTH_SECRET);
      const token = await new SignJWT({ email, name: user.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(id)
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);
      return { token };
    },
  );

  // Email + password login
  app.post<{ Body: { email?: string; password?: string } }>(
    "/api/v1/auth/login",
    { preHandler: loginLimiter },
    async (req, reply) => {
      const email = req.body?.email?.trim().toLowerCase();
      const password = req.body?.password;
      if (!email || !password) {
        return reply.code(400).send({ error: "email_and_password_required" });
      }
      const user = await repo.users.findByEmail(email);
      if (!user || !user.passwordHash) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      const secret = new TextEncoder().encode(env.DEV_AUTH_SECRET);
      const token = await new SignJWT({ email, name: user.name })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);
      return { token };
    },
  );

  // Verify email
  app.post<{ Body: { token?: string } }>(
    "/api/v1/auth/verify-email",
    async (req, reply) => {
      const { token } = req.body ?? {};
      if (!token) return reply.code(400).send({ error: "missing_token" });

      const entry = emailTokens.get(token);
      if (!entry || entry.type !== "verify") return reply.code(400).send({ error: "invalid_token" });
      if (Date.now() > entry.expiresAt) {
        emailTokens.delete(token);
        return reply.code(410).send({ error: "token_expired" });
      }

      await repo.users.update(entry.userId, { emailVerified: true });
      emailTokens.delete(token);
      return { ok: true };
    },
  );

  // Resend verification email
  app.post(
    "/api/v1/auth/resend-verification",
    { preHandler: requireAuth },
    async (req, reply) => {
      const user = await repo.users.findById(req.authClaims!.sub);
      if (!user) return reply.code(404).send({ error: "not_synced" });
      if (user.emailVerified) return reply.code(409).send({ error: "already_verified" });

      const verifyToken = randomUUID();
      emailTokens.set(verifyToken, { userId: user.id, type: "verify", expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      const ve = verificationEmail(user.name, verifyToken);
      await emailService.send({ to: user.email, subject: ve.subject, html: ve.html });
      return { ok: true };
    },
  );

  // Forgot password
  app.post<{ Body: { email?: string } }>(
    "/api/v1/auth/forgot-password",
    { preHandler: passwordResetLimiter },
    async (req, reply) => {
      const email = req.body?.email?.trim().toLowerCase();
      if (!email) return reply.code(400).send({ error: "missing_email" });

      const user = await repo.users.findByEmail(email);
      if (!user || !user.passwordHash) {
        // Don't reveal whether the email exists
        return { ok: true };
      }

      const resetToken = randomUUID();
      emailTokens.set(resetToken, { userId: user.id, type: "reset", expiresAt: Date.now() + 60 * 60 * 1000 });
      const re = passwordResetEmail(user.name, resetToken);
      await emailService.send({ to: user.email, subject: re.subject, html: re.html });
      return { ok: true };
    },
  );

  // Reset password
  app.post<{ Body: { token?: string; newPassword?: string } }>(
    "/api/v1/auth/reset-password",
    { preHandler: passwordResetLimiter },
    async (req, reply) => {
      const { token, newPassword } = req.body ?? {};
      if (!token || !newPassword) return reply.code(400).send({ error: "missing_fields" });
      if (newPassword.length < 6) return reply.code(400).send({ error: "password_too_short" });

      const entry = emailTokens.get(token);
      if (!entry || entry.type !== "reset") return reply.code(400).send({ error: "invalid_token" });
      if (Date.now() > entry.expiresAt) {
        emailTokens.delete(token);
        return reply.code(410).send({ error: "token_expired" });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await repo.users.update(entry.userId, { passwordHash: hash });
      emailTokens.delete(token);
      return { ok: true };
    },
  );

  // Change password
  app.post<{ Body: { currentPassword?: string; newPassword?: string } }>(
    "/api/v1/auth/change-password",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { currentPassword, newPassword } = req.body ?? {};
      if (!newPassword || newPassword.length < 6) {
        return reply.code(400).send({ error: "new_password_too_short" });
      }
      const user = await repo.users.findById(req.authClaims!.sub);
      if (!user) return reply.code(404).send({ error: "not_synced" });

      if (user.passwordHash) {
        if (!currentPassword) {
          return reply.code(400).send({ error: "current_password_required" });
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
          return reply.code(401).send({ error: "invalid_current_password" });
        }
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await repo.users.update(user.id, { passwordHash: hash });
      return { ok: true };
    },
  );

  // Verify email via Google OAuth — the frontend sends the Supabase access token
  // from the Google sign-in. We decode it to get the verified Google email, then
  // find the user by email and set emailVerified = true.
  app.post<{ Body: { googleToken?: string } }>(
    "/api/v1/auth/verify-google",
    async (req, reply) => {
      const googleToken = req.body?.googleToken;
      if (!googleToken) return reply.code(400).send({ error: "missing_google_token" });

      let googleEmail: string | undefined;
      try {
        const claims = await verifier.verify(googleToken);
        googleEmail = claims.email?.toLowerCase();
      } catch {
        return reply.code(401).send({ error: "invalid_google_token" });
      }

      if (!googleEmail) {
        return reply.code(400).send({ error: "no_email_in_token" });
      }

      const user = await repo.users.findByEmail(googleEmail);
      if (!user) return reply.code(404).send({ error: "user_not_found" });
      if (user.emailVerified) return reply.code(409).send({ error: "already_verified" });

      await repo.users.update(user.id, { emailVerified: true });
      return { ok: true, emailVerified: true };
    },
  );

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
