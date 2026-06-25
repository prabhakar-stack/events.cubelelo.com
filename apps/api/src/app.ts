import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Db } from "./db/store";
import { registerCompetitionRoutes } from "./modules/competitions/routes";
import { registerRoundRoutes } from "./modules/rounds/routes";
import { registerResultRoutes } from "./modules/results/routes";

/** Build the Fastify app around a given db (injectable for tests). */
export async function buildApp(db: Db): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  await registerCompetitionRoutes(app, db);
  await registerRoundRoutes(app, db);
  await registerResultRoutes(app, db);

  return app;
}
