import "./config/loadEnv"; // must be first — populates process.env before env.ts reads it
import { buildApp } from "./app";
import { seed } from "./db/seed";
import { createRealtime } from "./sockets/realtime";
import { env } from "./config/env";
import { registerJobs } from "./lib/jobs";
import { getQueue, closeQueue } from "./lib/jobQueue";
import { startRoundTicker } from "./lib/roundTicker";
import { initRoundScheduler, scheduleRoundJobs } from "./lib/roundScheduler";
import { closeRedis } from "./lib/redis";

// Choose storage backend: PostgreSQL when DATABASE_URL is set, in-memory otherwise.
let repo;
if (env.DATABASE_URL) {
  const { createPgRepo } = await import("./db/pg-repo");
  const { getPool } = await import("./db/pool");
  repo = createPgRepo(getPool());
  console.log("🗄️  Using PostgreSQL backend");
} else {
  const { createMemRepo } = await import("./db/mem-repo");
  repo = createMemRepo();
  console.log("🗄️  Using in-memory backend (no DATABASE_URL set)");
}

await seed(repo);

registerJobs();
if (env.REDIS_URL) await getQueue();

const realtime = createRealtime();
const app = await buildApp(repo, realtime);
await app.ready();
await realtime.attach(app, repo);

initRoundScheduler(repo, realtime);
const activeRounds = await repo.rounds.findActive();
for (const round of activeRounds) {
  if (round.opensAt || round.closesAt) await scheduleRoundJobs(round);
}
if (activeRounds.length > 0) console.log(`📋 Scheduled jobs for ${activeRounds.length} active rounds`);

const stopTicker = startRoundTicker(repo, realtime);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(
    `🧊 API + realtime on http://localhost:${env.PORT} (auth: ${env.authMode})`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

let shuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n⏳ ${signal} received — shutting down gracefully…`);
  stopTicker();
  await realtime.close();
  await closeQueue();
  await app.close();
  if (env.DATABASE_URL) {
    const { closePool } = await import("./db/pool");
    await closePool();
  }
  await closeRedis();
  console.log("✅ Shutdown complete");
  process.exit(0);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
