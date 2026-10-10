import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    environment: "node",
    include: ["tests/bundle/*.test.ts"],
    setupFiles: ["./tests/integration-env.ts"],
  },
});
