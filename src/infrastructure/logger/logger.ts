const SENSITIVE_KEY =
  /(password|passwordhash|token|apikey|api_key|authorization|cookie|secret|encrypted|prompt|masterkey)/i;
const REDACTED = "[redacted]";

type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : redact(inner)]),
    );
  }
  return value;
}

function write(level: LogLevel, event: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    event,
    ...(redact(fields) as LogFields),
    at: new Date().toISOString(),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export const logger: Logger = {
  info: (event, fields = {}) => write("info", event, fields),
  warn: (event, fields = {}) => write("warn", event, fields),
  error: (event, fields = {}) => write("error", event, fields),
};

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
