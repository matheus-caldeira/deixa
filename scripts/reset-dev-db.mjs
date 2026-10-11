#!/usr/bin/env node
import { rm } from "node:fs/promises";
import postgres from "postgres";

process.loadEnvFile(".env");
const url = new URL(process.env.DATABASE_URL ?? "");
const name = url.pathname.slice(1);
if (name !== "deixa") throw new Error("este script só recria o banco de desenvolvimento deixa");
url.pathname = "/postgres";
const admin = postgres(url.toString(), { max: 1, onnotice: () => undefined });
await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await admin.end({ timeout: 5 });
await rm("data/catalog", { recursive: true, force: true });
await rm("data/audio", { recursive: true, force: true });
console.log("banco de desenvolvimento e arquivos em data/ removidos; rode pnpm db:migrate && pnpm db:seed");
