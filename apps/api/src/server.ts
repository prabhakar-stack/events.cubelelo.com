import { buildApp } from "./app";
import { createDb, seed } from "./db/store";
import { env } from "./config/env";

const db = createDb();
await seed(db);
const app = await buildApp(db);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  // eslint-disable-next-line no-console
  console.log(`🧊 API listening on http://localhost:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
