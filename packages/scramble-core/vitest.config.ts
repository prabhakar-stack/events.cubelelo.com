import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // cubing.js loads WASM and runs random-state search (esp. 4x4) — allow headroom.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
