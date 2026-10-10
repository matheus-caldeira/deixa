import { posix } from "node:path";
import { pathToFileURL } from "node:url";
import { main } from "./run-hook.mjs";

const SECRET =
  /((?<![\w-])sk-ant-[\w-]{20,}|(?<![\w-])sk-[A-Za-z0-9]{20,}|eyJhbGciOi[\w-]{10,}\.[\w-]{20,}\.[\w-]{20,}|AIza[\w-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16})/;
const BLOCKED_PATH = /(^|\/)\.env(\.(?!example$)[\w.-]+)?$|(^|\/)data\/(catalog|audio|temp)(\/|$)/i;

export function checkSecrets({ file_path = "", content = "" }) {
  const normalized = posix.normalize(String(file_path).replace(/\\/g, "/"));
  if (BLOCKED_PATH.test(normalized)) return { blocked: true, reason: `escrita bloqueada em ${file_path}` };
  if (SECRET.test(content))
    return { blocked: true, reason: "conteúdo parece conter segredo; use variável de ambiente" };
  return { blocked: false };
}

export function checkSecretsInput(toolInput = {}) {
  const t = toolInput ?? {};
  const parts = [
    t.content,
    t.new_string,
    t.new_source,
    ...(Array.isArray(t.edits) ? t.edits.map((e) => e?.new_string) : []),
  ];
  return checkSecrets({
    file_path: t.file_path ?? t.notebook_path ?? "",
    content: parts.filter((p) => typeof p === "string").join("\n"),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main((input) => checkSecretsInput(input.tool_input));
}
