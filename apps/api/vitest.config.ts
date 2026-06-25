import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@cubers/types": pkg("../../packages/types/src/index.ts"),
      "@cubers/scramble-core": pkg("../../packages/scramble-core/src/index.ts"),
      "@cubers/timer-core": pkg("../../packages/timer-core/src/index.ts"),
    },
  },
  test: {
    testTimeout: 30_000,
  },
});
