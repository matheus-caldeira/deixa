import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";

const CERT_DIR = join("data", "certs");
const KEY = join(CERT_DIR, "dev-key.pem");
const CERT = join(CERT_DIR, "dev-cert.pem");
const PORT = process.env.PORT ?? "1301";
const VALID_DAYS = "825";

const addresses = Object.values(networkInterfaces())
  .flatMap((entries) => entries ?? [])
  .filter((entry) => entry.family === "IPv4")
  .map((entry) => entry.address);

if (!existsSync(KEY) || !existsSync(CERT)) {
  mkdirSync(CERT_DIR, { recursive: true });
  const names = ["DNS:localhost", ...addresses.map((address) => `IP:${address}`)].join(",");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-sha256",
      "-days",
      VALID_DAYS,
      "-subj",
      "/CN=Deixa local",
      "-addext",
      `subjectAltName=${names}`,
      "-keyout",
      KEY,
      "-out",
      CERT,
    ],
    { stdio: "ignore" },
  );
  console.info(`certificado criado em ${CERT_DIR} para ${names}`);
}

for (const address of addresses.filter((address) => address !== "127.0.0.1")) {
  console.info(`no celular: https://${address}:${PORT} (aceite o certificado na primeira visita)`);
}

spawn(
  "pnpm",
  [
    "exec",
    "next",
    "dev",
    "-H",
    "0.0.0.0",
    "-p",
    PORT,
    "--experimental-https",
    "--experimental-https-key",
    KEY,
    "--experimental-https-cert",
    CERT,
  ],
  { stdio: "inherit" },
).on("exit", (code) => process.exit(code ?? 0));
