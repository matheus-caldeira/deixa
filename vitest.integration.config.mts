import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./tests/integration-env.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
