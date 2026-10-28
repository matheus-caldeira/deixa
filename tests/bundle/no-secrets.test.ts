import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STATIC_DIR = ".next/static";
const WEB_DIR = ".next-web";
const SECRET_NAMES = [
  "TMDB_READ_ACCESS_TOKEN",
  "TMDB_API_KEY",
  "AI_CREDENTIALS_MASTER_KEY",
  "GEMINI_API_KEY",
  "OPENSUBTITLES_API_KEY",
  "OPENSUBTITLES_PASSWORD",
] as const;
const MIN_SECRET_LENGTH = 16;
const MASTER_KEY_FILE = "master-key.txt";

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function checkBundle(directory: string, options: { tmdbInBrowser: boolean }) {
  const files = existsSync(directory) ? filesUnder(directory) : [];
  const contents = files.map((path) => ({ path, text: readFileSync(path, "latin1") }));

  for (const name of SECRET_NAMES) {
    const value = process.env[name];
    it.skipIf(!value || value.length < MIN_SECRET_LENGTH)(`não contém o valor de ${name}`, () => {
      const leaking = contents.filter((file) => file.text.includes(value ?? "")).map((file) => file.path);
      expect(leaking).toEqual([]);
    });
  }

  const masterKey = existsSync(MASTER_KEY_FILE) ? readFileSync(MASTER_KEY_FILE, "utf8").trim() : "";
  it.skipIf(masterKey.length < MIN_SECRET_LENGTH)("não contém a chave mestra do arquivo", () => {
    const leaking = contents.filter((file) => file.text.includes(masterKey)).map((file) => file.path);
    expect(leaking).toEqual([]);
  });

  it("não cita variáveis de servidor nem usa NEXT_PUBLIC para o TMDB", () => {
    const pattern = options.tmdbInBrowser
      ? /NEXT_PUBLIC_TMDB/
      : /NEXT_PUBLIC_TMDB|TMDB_READ_ACCESS_TOKEN|api\.themoviedb\.org/;
    const mentions = contents.filter((file) => pattern.test(file.text)).map((file) => file.path);
    expect(mentions).toEqual([]);
  });
}

describe("bundle do cliente", () => {
  it("existe: rode pnpm build antes deste teste", () => {
    expect(existsSync(STATIC_DIR)).toBe(true);
  });

  checkBundle(STATIC_DIR, { tmdbInBrowser: false });
});

describe.skipIf(!existsSync(WEB_DIR))("bundle do alvo web (pnpm build:web)", () => {
  checkBundle(WEB_DIR, { tmdbInBrowser: true });
});
