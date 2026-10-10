#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const EXAMPLE_PATH = join(ROOT, ".env.example");

const DEV_DEFAULTS = {
  DATABASE_URL: () => "postgres://deixa:deixa@localhost:1442/deixa",
  AI_CREDENTIALS_MASTER_KEY: () => randomBytes(32).toString("base64"),
  KOKORO_URL: () => "http://localhost:1881",
  DATA_DIR: () => "data",
  GEMINI_MODEL: () => "gemini-2.5-flash",
  DEV_SHORTCUTS: () => "true",
};

function parseEntries(text) {
  const entries = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) entries.set(match[1], match[2]);
  }
  return entries;
}

const expectedNames = [...parseEntries(readFileSync(EXAMPLE_PATH, "utf8")).keys()];
const current = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
const present = parseEntries(current);

const added = [];
const stillEmpty = [];
let appended = "";
for (const name of expectedNames) {
  if ((present.get(name) ?? "") !== "") continue;
  const makeDefault = DEV_DEFAULTS[name];
  if (!makeDefault) {
    stillEmpty.push(name);
    continue;
  }
  appended += `${name}=${makeDefault()}\n`;
  added.push(name);
}

if (appended) {
  const separator = current === "" || current.endsWith("\n") ? "" : "\n";
  writeFileSync(ENV_PATH, current + separator + appended, { mode: 0o600 });
}

console.log(added.length ? `.env: preenchidas ${added.join(", ")}` : ".env: nada a preencher");
if (stillEmpty.length) console.log(`.env: sem valor (opcionais) ${stillEmpty.join(", ")}`);
