#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const STANDALONE = join(ROOT, ".next", "standalone");
const SERVER = join(ROOT, "src-tauri", "server");
const BINARIES = join(ROOT, "src-tauri", "binaries");
const MIGRATIONS = ["src", "infrastructure", "database", "migrations"];
const EXECUTABLE = 0o755;

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
for (const leftover of [
  ".env",
  ".env.example",
  "master-key.txt",
  "database-url.txt",
  "setup-code.txt",
  "data",
]) {
  rmSync(join(SERVER, leftover), { recursive: true, force: true });
}

const windows = process.platform === "win32";
const node = join(BINARIES, `node-${targetTriple()}${windows ? ".exe" : ""}`);
mkdirSync(BINARIES, { recursive: true });
cpSync(process.execPath, node, { dereference: true });
chmodSync(node, EXECUTABLE);

const megabytes = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;
console.info(
  `servidor empacotado em src-tauri/server; Node ${process.version} (${megabytes(statSync(node).size)})`,
);
