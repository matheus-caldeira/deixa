import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { e2eSetupTarget } from "../e2e/environment";

export const DESKTOP_PORT = 1312;
export const DESKTOP_BASE_URL = `http://127.0.0.1:${DESKTOP_PORT}`;
export const DESKTOP_HOME = resolve("data/desktop-e2e");
export const DESKTOP_DATABASE = "deixa_desktop_e2e";
const SERVER_FOLDER = resolve("src-tauri/server");
const BINARIES = resolve("src-tauri/binaries");

export function packagedNode(): string {
  const binary = readdirSync(BINARIES).find((name) => name.startsWith("node-"));
  if (!binary) throw new Error("Rode pnpm desktop:server antes do teste do pacote.");
  return join(BINARIES, binary);
}

export function packagedServerCommand(): string {
  const variables = [
    `PATH=${process.env.PATH ?? ""}`,
    "NODE_ENV=production",
    `PORT=${DESKTOP_PORT}`,
    "HOSTNAME=127.0.0.1",
    `DEIXA_CONFIG_DIR=${DESKTOP_HOME}`,
    `DATA_DIR=${join(DESKTOP_HOME, "data")}`,
    "SESSION_COOKIE_SECURE=false",
  ];
  return `cd "${SERVER_FOLDER}" && env -i ${variables.map((entry) => `"${entry}"`).join(" ")} "${packagedNode()}" server.js`;
}

export function desktopTarget() {
  return { ...e2eSetupTarget(), database: DESKTOP_DATABASE };
}
