import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { unzipSync } from "fflate";

export const POSTGRES_VERSION = "17.6.0";
const MAVEN_BASE = "https://repo1.maven.org/maven2/io/zonky/test/postgres";
const MAX_JAR_BYTES = 80_000_000;
const INSTALLED_MARK = "installed.json";

type Artifact = { name: string; sha256: string };

const ARTIFACTS: Record<string, Artifact> = {
  "darwin-arm64": {
    name: "darwin-arm64v8",
    sha256: "e87ee36767dee4f00f829d7a52e4a216e2fdebe5934c5683730940aabe570721",
  },
  "darwin-x64": {
    name: "darwin-amd64",
    sha256: "f1d6d39896ca48e65d6dbcb492d809df0d4952c65299de8af6e08d2208eae3e0",
  },
  "linux-x64": {
    name: "linux-amd64",
    sha256: "23da5a044b4fb7a5a081a45008c95749c873305328d73f86aefd56922ce1d29d",
  },
  "linux-arm64": {
    name: "linux-arm64v8",
    sha256: "84427ea54a5238247924ef3b0f940e7d027e58760f19d7325242e50d22fa014a",
  },
  "win32-x64": {
    name: "windows-amd64",
    sha256: "c91d39b6db91cf8811e3b20d941e74a0396e277360873821daab47cdb4c1282c",
  },
};

export type DownloadProgress = (received: number, total: number | null) => void;

export function artifactFor(platform = process.platform, arch = process.arch): Artifact | null {
  return ARTIFACTS[`${platform}-${arch}`] ?? null;
}

export function artifactUrl(artifact: Artifact): string {
  const base = `embedded-postgres-binaries-${artifact.name}`;
  return `${MAVEN_BASE}/${base}/${POSTGRES_VERSION}/${base}-${POSTGRES_VERSION}.jar`;
}

export function binariesDirectory(home: string): string {
  return join(home, "binaries", POSTGRES_VERSION);
}

export function binaryPath(home: string, tool: "initdb" | "postgres" | "pg_ctl"): string {
  const suffix = process.platform === "win32" ? ".exe" : "";
  return join(binariesDirectory(home), "bin", `${tool}${suffix}`);
}

export function binariesInstalled(home: string): boolean {
  return (
    existsSync(join(binariesDirectory(home), INSTALLED_MARK)) && existsSync(binaryPath(home, "postgres"))
  );
}

async function download(url: string, onProgress: DownloadProgress): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`download do Postgres respondeu ${response.status}`);
  const total = Number(response.headers.get("content-length")) || null;
  if (total && total > MAX_JAR_BYTES) throw new Error("download do Postgres maior que o esperado");
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (received > MAX_JAR_BYTES) throw new Error("download do Postgres maior que o esperado");
    onProgress(received, total);
  }
  return Buffer.concat(chunks);
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} saiu com ${code}: ${stderr.trim().slice(0, 300)}`)),
    );
  });
}

export async function installBinaries(home: string, onProgress: DownloadProgress): Promise<void> {
  if (binariesInstalled(home)) return;
  const artifact = artifactFor();
  if (!artifact) throw new Error(`sem binários do Postgres para ${process.platform}-${process.arch}`);
  const jar = await download(artifactUrl(artifact), onProgress);
  const digest = createHash("sha256").update(jar).digest("hex");
  if (digest !== artifact.sha256) throw new Error("o download do Postgres não bate com o hash esperado");
  const entries = unzipSync(new Uint8Array(jar), { filter: (file) => file.name.endsWith(".txz") });
  const archive = Object.values(entries)[0];
  if (!archive) throw new Error("o pacote do Postgres não tem o arquivo esperado");
  const directory = binariesDirectory(home);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const archivePath = join(directory, "postgres.txz");
  writeFileSync(archivePath, archive);
  await run("tar", ["-xf", archivePath, "-C", directory], directory);
  rmSync(archivePath, { force: true });
  if (!existsSync(binaryPath(home, "postgres"))) throw new Error("o pacote do Postgres veio sem o binário");
  writeFileSync(
    join(directory, INSTALLED_MARK),
    JSON.stringify({
      version: POSTGRES_VERSION,
      artifact: artifact.name,
      installedAt: new Date().toISOString(),
    }),
  );
}

export function readInstalledVersion(home: string): string | null {
  const mark = join(binariesDirectory(home), INSTALLED_MARK);
  if (!existsSync(mark)) return null;
  try {
    const parsed = JSON.parse(readFileSync(mark, "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}
