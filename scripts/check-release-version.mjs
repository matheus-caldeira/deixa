#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const tag = process.argv[2] ?? "";
const expected = tag.replace(/^v/, "");

const read = (path) => readFileSync(join(ROOT, path), "utf8");
const versions = {
  "package.json": JSON.parse(read("package.json")).version,
  "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
  "src-tauri/Cargo.toml": read("src-tauri/Cargo.toml").match(/^version = "([^"]+)"/m)?.[1],
  "src/shared/app.ts": read("src/shared/app.ts").match(/APP_VERSION = "([^"]+)"/)?.[1],
};

const wrong = Object.entries(versions).filter(([, version]) => version !== expected);
if (!/^\d+\.\d+\.\d+$/.test(expected) || wrong.length > 0) {
  console.error(`a tag ${tag} não bate com a versão do app:`);
  for (const [file, version] of Object.entries(versions)) console.error(`  ${file}: ${version}`);
  process.exit(1);
}
console.info(`versão ${expected} conferida em ${Object.keys(versions).length} arquivos`);
