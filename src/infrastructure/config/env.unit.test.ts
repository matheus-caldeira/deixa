import { describe, expect, it } from "vitest";
import { hasTmdbCredentials, parseEnv } from "./env";

const MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
const base = { DATABASE_URL: "postgres://u:p@localhost:1442/db", AI_CREDENTIALS_MASTER_KEY: MASTER_KEY };

describe("variáveis de ambiente", () => {
  it("aplica padrões e trata string vazia como ausente", () => {
    const env = parseEnv({ ...base, TMDB_READ_ACCESS_TOKEN: "", KOKORO_URL: "", DATA_DIR: "" });
    expect(env.DATA_DIR).toBe("data");
    expect(env.KOKORO_URL).toBeUndefined();
    expect(env.DEV_SHORTCUTS).toBe(false);
    expect(hasTmdbCredentials(env)).toBe(false);
  });

  it("reconhece credenciais do TMDB sem expor o valor na mensagem de erro", () => {
    const env = parseEnv({ ...base, TMDB_READ_ACCESS_TOKEN: "token-de-teste", DEV_SHORTCUTS: "true" });
    expect(hasTmdbCredentials(env)).toBe(true);
    expect(env.DEV_SHORTCUTS).toBe(true);
  });

  it("recusa chave mestra com tamanho errado e cita só o nome da variável", () => {
    expect(() => parseEnv({ ...base, AI_CREDENTIALS_MASTER_KEY: "curta" })).toThrow(
      /AI_CREDENTIALS_MASTER_KEY/,
    );
    expect(() => parseEnv({ AI_CREDENTIALS_MASTER_KEY: MASTER_KEY })).toThrow(/DATABASE_URL/);
  });
});
