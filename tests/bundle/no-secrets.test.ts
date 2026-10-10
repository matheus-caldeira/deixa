import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const STATIC_DIR = ".next/static";
const SECRET_NAMES = ["TMDB_READ_ACCESS_TOKEN", "TMDB_API_KEY", "AI_CREDENTIALS_MASTER_KEY"] as const;
const MIN_SECRET_LENGTH = 16;

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("bundle do cliente", () => {
  it("existe: rode pnpm build antes deste teste", () => {
    expect(existsSync(STATIC_DIR)).toBe(true);
  });

  const files = existsSync(STATIC_DIR) ? filesUnder(STATIC_DIR) : [];
  const contents = files.map((path) => ({ path, text: readFileSync(path, "latin1") }));

  for (const name of SECRET_NAMES) {
    const value = process.env[name];
    it.skipIf(!value || value.length < MIN_SECRET_LENGTH)(`não contém o valor de ${name}`, () => {
      const leaking = contents.filter((file) => file.text.includes(value ?? "")).map((file) => file.path);
      expect(leaking).toEqual([]);
    });
  }

  it("não cita variáveis de servidor nem usa NEXT_PUBLIC para o TMDB", () => {
    const mentions = contents
      .filter((file) => /NEXT_PUBLIC_TMDB|TMDB_READ_ACCESS_TOKEN|api\.themoviedb\.org/.test(file.text))
      .map((file) => file.path);
    expect(mentions).toEqual([]);
  });
});
