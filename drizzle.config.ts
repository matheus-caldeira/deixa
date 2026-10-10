import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/database/schema/index.ts",
  out: "./src/infrastructure/database/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://deixa:deixa@localhost:5442/deixa" },
  strict: true,
});
