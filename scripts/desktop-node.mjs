import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const DIST = "https://nodejs.org/dist";
const SHASUMS = "SHASUMS256.txt";
const EXECUTABLE = 0o755;
const DOWNLOAD_TIMEOUT_MS = 300_000;
export const LOCAL_NODE_VARIABLE = "DEIXA_DESKTOP_LOCAL_NODE";

const PLATFORMS = {
  "aarch64-apple-darwin": { name: "darwin-arm64", os: "macos" },
  "x86_64-apple-darwin": { name: "darwin-x64", os: "macos" },
  "aarch64-unknown-linux-gnu": { name: "linux-arm64", os: "linux" },
  "x86_64-unknown-linux-gnu": { name: "linux-x64", os: "linux" },
  "aarch64-pc-windows-msvc": { name: "win-arm64", os: "windows" },
  "x86_64-pc-windows-msvc": { name: "win-x64", os: "windows" },
};

export function pinnedNodeVersion(root) {
  const version = readFileSync(join(root, ".nvmrc"), "utf8").trim().replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`o .nvmrc precisa fixar a versão exata do Node (ex.: 24.22.1), não "${version}"`);
  }
  return version;
}

function platformFor(triple) {
  const platform = PLATFORMS[triple];
  if (!platform) throw new Error(`plataforma sem Node oficial conhecido: ${triple}`);
  return platform;
}

function remoteFileFor(version, platform) {
  if (platform.os === "windows") return `${platform.name}/node.exe`;
  return `node-v${version}-${platform.name}.tar.gz`;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function expectedHash(shasums, file) {
  const line = shasums.split(/\r?\n/).find((entry) => entry.trim().endsWith(`  ${file}`));
  const hash = line?.trim().split(/\s+/)[0];
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) throw new Error(`${file} não aparece no ${SHASUMS}`);
  return hash;
}

async function download(url, destination) {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`download falhou (${response.status}): ${url}`);
  const partial = `${destination}.partial`;
  writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
  renameSync(partial, destination);
}

async function cachedShasums(cache, version) {
  const path = join(cache, `${SHASUMS}`);
  if (!existsSync(path)) await download(`${DIST}/v${version}/${SHASUMS}`, path);
  return readFileSync(path, "utf8");
}

async function verifiedDownload(cache, version, file) {
  const expected = expectedHash(await cachedShasums(cache, version), file);
  const path = join(cache, file.replaceAll("/", "-"));
  if (existsSync(path) && sha256(path) === expected) return path;
  rmSync(path, { force: true });
  await download(`${DIST}/v${version}/${file}`, path);
  const actual = sha256(path);
  if (actual !== expected) {
    rmSync(path, { force: true });
    throw new Error(`hash do ${file} não confere com o ${SHASUMS}; arquivo apagado`);
  }
  return path;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: ["ignore", "ignore", "inherit"] });
  return result.status === 0;
}

function extractNode(archive, version, platform, workspace) {
  const member = `node-v${version}-${platform.name}/bin/node`;
  if (!run("tar", ["-xzf", archive, "-C", workspace, member])) {
    throw new Error(`não foi possível extrair ${member}`);
  }
  return join(workspace, member);
}

function stripLinux(binary) {
  return run("strip", ["--strip-all", binary]);
}

function stripMacos(binary) {
  const candidate = `${binary}.stripped`;
  copyFileSync(binary, candidate);
  const ready =
    run("strip", ["-x", candidate]) &&
    run("codesign", ["--force", "--sign", "-", candidate]) &&
    run(candidate, ["-e", "process.exit(0)"]);
  if (!ready) {
    rmSync(candidate, { force: true });
    return false;
  }
  renameSync(candidate, binary);
  return true;
}

const STRIPPERS = { linux: stripLinux, darwin: stripMacos };
const HOST_OS = { linux: "linux", darwin: "macos" };

function stripWhenSafe(binary, platform) {
  const strip = STRIPPERS[process.platform];
  if (!strip || HOST_OS[process.platform] !== platform.os) return false;
  return strip(binary);
}

function replaceFile(source, destination) {
  const staging = `${destination}.staging`;
  rmSync(staging, { force: true });
  copyFileSync(source, staging);
  chmodSync(staging, EXECUTABLE);
  rmSync(destination, { force: true });
  renameSync(staging, destination);
}

export async function provideNode({ root, triple, destination }) {
  if (process.env[LOCAL_NODE_VARIABLE] === "1") {
    replaceFile(process.execPath, destination);
    return { origin: `local ${process.version}`, bytes: statSync(destination).size, stripped: false };
  }
  const version = pinnedNodeVersion(root);
  const platform = platformFor(triple);
  const cache = join(root, "node_modules", ".cache", "deixa-node", `v${version}`);
  mkdirSync(cache, { recursive: true });
  const archive = await verifiedDownload(cache, version, remoteFileFor(version, platform));
  const workspace = mkdtempSync(join(cache, "extract-"));
  try {
    const binary = platform.os === "windows" ? archive : extractNode(archive, version, platform, workspace);
    const officialBytes = statSync(binary).size;
    const staged = join(workspace, "node");
    if (binary !== staged) copyFileSync(binary, staged);
    const stripped = stripWhenSafe(staged, platform);
    replaceFile(staged, destination);
    return {
      origin: `oficial v${version} ${platform.name}`,
      officialBytes,
      bytes: statSync(destination).size,
      stripped,
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
