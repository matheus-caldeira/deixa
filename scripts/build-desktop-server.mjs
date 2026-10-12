#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STANDALONE = join(ROOT, ".next", "standalone");
const SERVER = join(ROOT, "src-tauri", "server");
const BINARIES = join(ROOT, "src-tauri", "binaries");
const MIGRATIONS = ["src", "infrastructure", "database", "migrations"];
const EXECUTABLE = 0o755;
const MIN_SECRET_LENGTH = 12;
const SECRET_FILES = ["master-key.txt", "database-url.txt", "setup-code.txt"];
const NOT_SECRET = new Set([
  "NODE_ENV",
  "DATA_DIR",
  "GEMINI_MODEL",
  "KOKORO_URL",
  "SESSION_COOKIE_SECURE",
  "DEV_SHORTCUTS",
]);

function secretValues() {
  const values = new Set();
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (match && !NOT_SECRET.has(match[1])) values.add(match[2].trim().replace(/^["']|["']$/g, ""));
    }
  }
  for (const file of SECRET_FILES) {
    const path = join(ROOT, file);
    if (existsSync(path)) values.add(readFileSync(path, "utf8").trim());
  }
  return [...values].filter((value) => value.length >= MIN_SECRET_LENGTH);
}

function filesUnder(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    const stats = statSync(path, { throwIfNoEntry: false });
    if (!stats) return [];
    if (stats.isDirectory()) return filesUnder(path);
    return stats.isFile() ? [path] : [];
  });
}

function assertNoSecrets(folder) {
  const secrets = secretValues();
  const leaking = filesUnder(folder).filter((path) => {
    const text = readFileSync(path, "latin1");
    return secrets.some((secret) => text.includes(secret));
  });
  if (leaking.length > 0) {
    rmSync(folder, { recursive: true, force: true });
    throw new Error(
      `segredo encontrado no servidor empacotado; pacote apagado: ${leaking.length} arquivo(s)`,
    );
  }
  return secrets.length;
}

function targetTriple() {
  const cargo = join(process.env.HOME ?? "", ".cargo", "bin", "rustc");
  const output = execFileSync(existsSync(cargo) ? cargo : "rustc", ["-vV"], { encoding: "utf8" });
  const host = output.split("\n").find((line) => line.startsWith("host: "));
  if (!host) throw new Error("não foi possível descobrir a plataforma do Rust");
  return host.slice("host: ".length).trim();
}

const build = spawnSync("pnpm", ["exec", "next", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production", DEIXA_STANDALONE: "1" },
});
if (build.status !== 0) process.exit(build.status ?? 1);
if (!existsSync(join(STANDALONE, "server.js")))
  throw new Error("o build não gerou .next/standalone/server.js");

rmSync(SERVER, { recursive: true, force: true });
cpSync(STANDALONE, SERVER, { recursive: true, dereference: true });
cpSync(join(ROOT, ".next", "static"), join(SERVER, ".next", "static"), { recursive: true });
cpSync(join(ROOT, "public"), join(SERVER, "public"), { recursive: true });
cpSync(join(ROOT, ...MIGRATIONS), join(SERVER, ...MIGRATIONS), { recursive: true });
cpSync(join(ROOT, "fixtures"), join(SERVER, "fixtures"), { recursive: true });
for (const leftover of readdirSync(SERVER).filter((name) => name.startsWith(".env"))) {
  rmSync(join(SERVER, leftover), { force: true });
}
for (const leftover of [...SECRET_FILES, "data"]) {
  rmSync(join(SERVER, leftover), { recursive: true, force: true });
}
const checkedSecrets = assertNoSecrets(SERVER);

const windows = process.platform === "win32";
const node = join(BINARIES, `node-${targetTriple()}${windows ? ".exe" : ""}`);
mkdirSync(BINARIES, { recursive: true });
cpSync(process.execPath, node, { dereference: true });
chmodSync(node, EXECUTABLE);

const megabytes = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;
console.info(
  `servidor empacotado em src-tauri/server; Node ${process.version} (${megabytes(statSync(node).size)}); ${checkedSecrets} segredo(s) conferidos, nenhum no pacote`,
);
