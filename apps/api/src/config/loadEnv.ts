import { config } from "dotenv";
import { fileURLToPath } from "node:url";

/**
 * Loads environment variables before any module reads them. Import this FIRST in
 * the server entrypoint so the side effect runs before config/env.ts evaluates.
 * Loads the repo-root .env, then a local apps/api/.env if present.
 */
config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });
config();
