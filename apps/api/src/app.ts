import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Db } from "./db/store";
import { type Realtime, noopRealtime } from "./sockets/realtime";
import { createVerifier, type Verifier } from "./auth/verifier";
import { registerAuth } from "./auth/plugin";
import { registerAuthRoutes } from "./modules/auth/routes";
import { registerCompetitionRoutes } from "./modules/competitions/routes";
import { registerRoundRoutes } from "./modules/rounds/routes";
import { registerResultRoutes } from "./modules/results/routes";
import { registerAdminRoutes } from "./modules/admin/routes";

/** Build the Fastify app around a db, realtime emitter, and auth verifier. */
export async function buildApp(
  db: Db,
  realtime: Realtime = noopRealtime,
  verifier: Verifier = createVerifier(),
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  registerAuth(app, verifier);

  app.get("/health", async () => ({ status: "ok" }));

  await registerAuthRoutes(app, db, verifier);
  await registerCompetitionRoutes(app, db);
  await registerRoundRoutes(app, db, realtime);
  await registerResultRoutes(app, db, realtime);
  await registerAdminRoutes(app, db);

  return app;
}
