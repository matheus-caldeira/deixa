import { z } from "zod";

const MASTER_KEY_BYTES = 32;

const blankAsUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(blankAsUndefined, z.string().min(1).optional());

const masterKey = z.string().refine((value) => Buffer.from(value, "base64").length === MASTER_KEY_BYTES, {
  message: "AI_CREDENTIALS_MASTER_KEY precisa ter 32 bytes em base64",
});

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AI_CREDENTIALS_MASTER_KEY: masterKey,
  TMDB_API_KEY: optionalText,
  TMDB_READ_ACCESS_TOKEN: optionalText,
  KOKORO_URL: z.preprocess(blankAsUndefined, z.url().optional()),
  DATA_DIR: z.preprocess(blankAsUndefined, z.string().default("data")),
  GEMINI_API_KEY: optionalText,
  GEMINI_MODEL: z.preprocess(blankAsUndefined, z.string().default("gemini-2.5-flash")),
  SESSION_COOKIE_SECURE: z.preprocess(
    blankAsUndefined,
    z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
  ),
  DEV_SHORTCUTS: z.preprocess(
    blankAsUndefined,
    z
      .enum(["true", "false", "1", "0"])
      .default("false")
      .transform((value) => value === "true" || value === "1"),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${names}. Rode pnpm setup:env.`);
  }
  return parsed.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

export function hasTmdbCredentials(env: Env): boolean {
  return Boolean(env.TMDB_READ_ACCESS_TOKEN || env.TMDB_API_KEY);
}
