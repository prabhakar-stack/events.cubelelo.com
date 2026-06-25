import "./config/loadEnv"; // must be first — populates process.env before env.ts reads it
import { buildApp } from "./app";
import { createDb, seed } from "./db/store";
import { createRealtime } from "./sockets/realtime";
import { env } from "./config/env";

const db = createDb();
await seed(db);

const realtime = createRealtime();
const app = await buildApp(db, realtime);
await app.ready();
realtime.attach(app, db); // attach Socket.io to the underlying HTTP server

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
