import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    environment: "node",
    include: ["src/**/*.unit.test.ts"],
  },
});
