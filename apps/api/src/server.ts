import { buildApp } from "./app";
import { createDb, seed } from "./db/store";
import { createRealtime } from "./sockets/realtime";
import { env } from "./config/env";

const db = createDb();
await seed(db);

const realtime = createRealtime();
const app = await buildApp(db, realtime);
await app.ready();
realtime.attach(app); // attach Socket.io to the underlying HTTP server

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  // eslint-disable-next-line no-console
  console.log(`🧊 API + realtime listening on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
