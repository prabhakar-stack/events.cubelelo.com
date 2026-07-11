import "./config/loadEnv"; // must be first — populates process.env before env.ts reads it
import { buildApp } from "./app";
import { seed } from "./db/seed";
import { createRealtime } from "./sockets/realtime";
import { env } from "./config/env";
import { registerJobs } from "./lib/jobs";
import { getQueue } from "./lib/jobQueue";
import { startRoundTicker } from "./lib/roundTicker";

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
startRoundTicker(repo, realtime);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  // eslint-disable-next-line no-console
  console.log(
    `🧊 API + realtime on http://localhost:${env.PORT} (auth: ${env.authMode})`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
