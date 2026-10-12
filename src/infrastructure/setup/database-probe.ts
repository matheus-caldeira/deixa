import { Socket } from "node:net";
import postgres from "postgres";
import { runMigrations } from "../database/migrate";

const SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);
const POSTGRES_ANSWERS = new Set(["S", "N"]);
const PROBE_TIMEOUT_MS = 700;
const CONNECT_TIMEOUT_SECONDS = 5;
const LOCAL_HOST = "127.0.0.1";
export const CANDIDATE_PORTS = [5432, 5433, 1442] as const;
export const TESTED_MAJOR_VERSION = 17;

export type DetectedServer = { host: string; port: number };
export type ConnectionResult = { ok: true; majorVersion: number | null } | { ok: false; message: string };

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
    socket.connect(port, LOCAL_HOST, () => socket.write(SSL_REQUEST));
  });
}

export async function detectLocalServers(
  ports: readonly number[] = CANDIDATE_PORTS,
): Promise<DetectedServer[]> {
  const found = await Promise.all(ports.map(async (port) => ((await speaksPostgres(port)) ? [port] : [])));
  return found.flat().map((port) => ({ host: "localhost", port }));
}

const MESSAGES: Record<string, string> = {
  ECONNREFUSED: "Não há Postgres respondendo nesse endereço e porta.",
  ENOTFOUND: "Não encontramos esse servidor. Confira o endereço.",
  ETIMEDOUT: "O servidor não respondeu a tempo. Confira o endereço e a porta.",
  CONNECT_TIMEOUT: "O servidor não respondeu a tempo. Confira o endereço e a porta.",
  "28P01": "Usuário ou senha recusados pelo Postgres.",
  "28000": "O Postgres não autorizou esse usuário. Confira usuário, senha e as regras de acesso do servidor.",
  "3D000": "Esse banco não existe e não foi possível criá-lo. Crie o banco ou informe outro.",
  "42501": "Esse usuário não tem permissão para criar o banco ou as tabelas. Use um usuário com permissão.",
  "53300": "O Postgres está sem conexões livres. Tente de novo em instantes.",
};
const GENERIC = "Não foi possível conectar. Confira os dados e tente de novo.";

export function describeConnectionError(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return (typeof code === "string" ? MESSAGES[code] : undefined) ?? GENERIC;
}

const HOST_SHAPE = /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])$/i;
const DATABASE_PATH = /^\/[a-z0-9_]{1,60}$/;
const SSL_MODES = new Set(["disable", "prefer", "require", "verify-full"]);
const SSL_PARAMETER = "sslmode";

export function normalizePostgresUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
  if (!HOST_SHAPE.test(url.hostname) || !DATABASE_PATH.test(url.pathname) || url.hash !== "") return null;
  if (url.username === "") return null;
  const parameters = [...url.searchParams.keys()];
  const sslMode = url.searchParams.get(SSL_PARAMETER);
  if (parameters.some((name) => name !== SSL_PARAMETER) || parameters.length > 1) return null;
  if (sslMode !== null && !SSL_MODES.has(sslMode)) return null;
  const credentials = url.password === "" ? url.username : `${url.username}:${url.password}`;
  const port = url.port === "" ? "" : `:${url.port}`;
  const query = sslMode === null ? "" : `?${SSL_PARAMETER}=${sslMode}`;
  return `postgres://${credentials}@${url.hostname.toLowerCase()}${port}${url.pathname}${query}`;
}

async function readMajorVersion(url: string): Promise<number | null> {
  const client = postgres(url, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SECONDS,
    onnotice: () => undefined,
  });
  try {
    const [row] = await client<
      { version: string }[]
    >`select current_setting('server_version_num') as version`;
    const major = Math.floor(Number(row?.version) / 10_000);
    return Number.isInteger(major) && major > 0 ? major : null;
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function connectAndPrepare(
  input: string,
): Promise<{ ok: true; url: string; majorVersion: number | null } | { ok: false; message: string }> {
  const url = normalizePostgresUrl(input);
  if (!url) {
    return {
      ok: false,
      message:
        "Endereço inválido. Use postgres://usuario:senha@servidor:porta/banco, com o nome do banco em minúsculas.",
    };
  }
  try {
    await runMigrations(url);
    return { ok: true, url, majorVersion: await readMajorVersion(url) };
  } catch (error) {
    return { ok: false, message: describeConnectionError(error) };
  }
}
