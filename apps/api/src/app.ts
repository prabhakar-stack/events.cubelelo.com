import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Repository } from "./db/repo";
import { type Realtime, noopRealtime } from "./sockets/realtime";
import { createVerifier, type Verifier } from "./auth/verifier";
import { registerAuth } from "./auth/plugin";
import { registerAuthRoutes } from "./modules/auth/routes";
import { registerCompetitionRoutes } from "./modules/competitions/routes";
import { registerRoundRoutes } from "./modules/rounds/routes";
import { registerResultRoutes } from "./modules/results/routes";
import { registerAdminRoutes } from "./modules/admin/routes";
import { registerRegistrationRoutes } from "./modules/registration/routes";
import { registerPaymentRoutes } from "./modules/payments/routes";
import { registerUserRoutes } from "./modules/users/routes";

/** Build the Fastify app around a repository, realtime emitter, and auth verifier. */
export async function buildApp(
  repo: Repository,
  realtime: Realtime = noopRealtime,
  verifier: Verifier = createVerifier(),
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  registerAuth(app, verifier);

  app.get("/health", async (_req, reply) => {
    try {
      const db = await repo.ping();
      return {
        status: "ok",
        db: db ?? { backend: "memory", latencyMs: 0 },
      };
    } catch (err) {
      reply.code(503);
      return { status: "error", db: null, error: String(err) };
    }
  });

  await registerAuthRoutes(app, repo, verifier);
  await registerCompetitionRoutes(app, repo);
  await registerRoundRoutes(app, repo, realtime);
  await registerResultRoutes(app, repo, realtime);
  await registerAdminRoutes(app, repo);
  await registerRegistrationRoutes(app, repo);
  await registerPaymentRoutes(app, repo);
  await registerUserRoutes(app, repo);

  return app;
}
