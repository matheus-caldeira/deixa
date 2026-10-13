import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Socket, createServer } from "node:net";
import postgres from "postgres";
import { z } from "zod";
import type { EmbeddedDatabasePhase } from "@/shared/embedded-database";
import { POSTGRES_VERSION, binaryPath, installBinaries, type DownloadProgress } from "./binaries";

export const EMBEDDED_DIRECTORY = "postgres";
const CONFIG_FILE = "embedded.json";
const DATA_DIRECTORY = "data";
const DATABASE = "deixa";
const USER = "deixa";
const HOST = "127.0.0.1";
const PORT_RANGE = { from: 1443, to: 1499 };
const PASSWORD_BYTES = 24;
const OWNER_ONLY = 0o600;
const READY_ATTEMPTS = 60;
const READY_INTERVAL_MS = 500;
const STOP_WAIT_MS = 10_000;
const PROBE_TIMEOUT_MS = 700;
const SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);
const POSTGRES_ANSWERS = new Set(["S", "N"]);

const configSchema = z.object({
  version: z.string(),
  port: z.number().int().min(1).max(65_535),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
});
export type EmbeddedConfig = z.infer<typeof configSchema>;

export type EmbeddedPhase = EmbeddedDatabasePhase;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function speaksPostgres(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const finish = (found: boolean) => {
      socket.destroy();
      resolve(found);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.once("close", () => finish(false));
    socket.once("data", (data) => finish(POSTGRES_ANSWERS.has(data.subarray(0, 1).toString("latin1"))));
    socket.connect(port, HOST, () => socket.write(SSL_REQUEST));
  });
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, HOST, () => server.close(() => resolve(true)));
  });
}

async function pickPort(): Promise<number> {
  for (let port = PORT_RANGE.from; port <= PORT_RANGE.to; port += 1) {
    if (await portIsFree(port)) return port;
  }
  throw new Error("nenhuma porta livre para o Postgres embutido");
}

export function connectionUrl(config: EmbeddedConfig): string {
  const credentials = `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}`;
  return `postgres://${credentials}@${HOST}:${config.port}/${config.database}`;
}

export class EmbeddedPostgres {
  private child: ChildProcess | null = null;
  private state: EmbeddedPhase = { phase: "idle" };
  private starting: Promise<string> | null = null;

  constructor(private readonly home: string) {}

  get status(): EmbeddedPhase {
    return this.state;
  }

  private get dataDirectory(): string {
    return join(this.home, DATA_DIRECTORY);
  }

  readConfig(): EmbeddedConfig | null {
    const path = join(this.home, CONFIG_FILE);
    if (!existsSync(path)) return null;
    try {
      const parsed = configSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  isConfigured(): boolean {
    return this.readConfig() !== null && existsSync(join(this.dataDirectory, "PG_VERSION"));
  }

  private writeConfig(config: EmbeddedConfig): void {
    mkdirSync(this.home, { recursive: true });
    writeFileSync(join(this.home, CONFIG_FILE), `${JSON.stringify(config)}\n`, { mode: OWNER_ONLY });
  }

  private run(tool: "initdb" | "pg_ctl", args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath(this.home, tool), args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`${tool} saiu com ${code}: ${stderr.trim().slice(0, 300)}`)),
      );
    });
  }

  private async initialize(): Promise<EmbeddedConfig> {
    const known = this.readConfig();
    if (known && existsSync(join(this.dataDirectory, "PG_VERSION"))) return known;
    rmSync(this.dataDirectory, { recursive: true, force: true });
    const config: EmbeddedConfig = {
      version: POSTGRES_VERSION,
      port: known?.port ?? (await pickPort()),
      user: USER,
      password: known?.password ?? randomBytes(PASSWORD_BYTES).toString("base64url"),
      database: DATABASE,
    };
    const passwordFile = join(this.home, "initdb-password.txt");
    mkdirSync(this.home, { recursive: true });
    writeFileSync(passwordFile, `${config.password}\n`, { mode: OWNER_ONLY });
    try {
      await this.run("initdb", [
        "-D",
        this.dataDirectory,
        "-U",
        config.user,
        `--pwfile=${passwordFile}`,
        "--auth=scram-sha-256",
        "-E",
        "UTF8",
        "--no-locale",
      ]);
    } finally {
      rmSync(passwordFile, { force: true });
    }
    this.writeConfig(config);
    return config;
  }

  private async alreadyRunning(config: EmbeddedConfig): Promise<boolean> {
    return speaksPostgres(config.port);
  }

  private spawnServer(config: EmbeddedConfig): void {
    const child = spawn(
      binaryPath(this.home, "postgres"),
      [
        "-D",
        this.dataDirectory,
        "-p",
        String(config.port),
        "-c",
        `listen_addresses=${HOST}`,
        "-c",
        "unix_socket_directories=",
      ],
      { stdio: "ignore", detached: process.platform !== "win32" },
    );
    child.once("exit", () => {
      if (this.child === child) this.child = null;
    });
    child.unref();
    this.child = child;
  }

  private async waitUntilReady(config: EmbeddedConfig): Promise<void> {
    for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
      if (await this.alreadyRunning(config)) {
        const sql = postgres(connectionUrl({ ...config, database: "postgres" }), {
          max: 1,
          connect_timeout: 5,
        });
        try {
          await sql`select 1`;
          return;
        } catch {
          await sql.end({ timeout: 1 }).catch(() => undefined);
        } finally {
          await sql.end({ timeout: 1 }).catch(() => undefined);
        }
      }
      await sleep(READY_INTERVAL_MS);
    }
    throw new Error("o Postgres embutido não ficou pronto a tempo");
  }

  private async ensureDatabase(config: EmbeddedConfig): Promise<void> {
    const sql = postgres(connectionUrl({ ...config, database: "postgres" }), { max: 1, connect_timeout: 5 });
    try {
      const known = await sql`select 1 from pg_database where datname = ${config.database}`;
      if (known.length === 0) await sql.unsafe(`CREATE DATABASE ${config.database}`);
    } finally {
      await sql.end({ timeout: 5 });
    }
  }

  async install(onProgress?: (state: EmbeddedPhase) => void): Promise<string> {
    const report = (state: EmbeddedPhase) => {
      this.state = state;
      onProgress?.(state);
    };
    try {
      const download: DownloadProgress = (received, total) =>
        report({ phase: "downloading", percent: total ? Math.round((received / total) * 100) : null });
      report({ phase: "downloading", percent: 0 });
      await installBinaries(this.home, download);
      report({ phase: "initializing" });
      await this.initialize();
      report({ phase: "starting" });
      const url = await this.start();
      report({ phase: "ready" });
      return url;
    } catch (error) {
      report({ phase: "failed", message: error instanceof Error ? error.message : "falha desconhecida" });
      throw error;
    }
  }

  async start(): Promise<string> {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const config = this.readConfig();
      if (!config) throw new Error("o Postgres embutido não está configurado");
      if (!(await this.alreadyRunning(config))) {
        this.spawnServer(config);
        await this.waitUntilReady(config);
      }
      await this.ensureDatabase(config);
      return connectionUrl(config);
    })().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async stop(): Promise<void> {
    if (!existsSync(join(this.dataDirectory, "postmaster.pid"))) return;
    try {
      await this.run("pg_ctl", [
        "-D",
        this.dataDirectory,
        "stop",
        "-m",
        "fast",
        "-t",
        String(STOP_WAIT_MS / 1000),
      ]);
    } catch {
      this.child?.kill();
    }
    this.child = null;
  }
}
