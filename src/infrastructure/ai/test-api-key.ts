import type { AiAccess } from "./models";

const TIMEOUT_MS = 8000;
const ANTHROPIC_VERSION = "2023-06-01";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

type Probe = { url: string; headers: Record<string, string> };

function probeFor(access: AiAccess): Probe | null {
  const bearer: Record<string, string> = access.apiKey ? { authorization: `Bearer ${access.apiKey}` } : {};
  switch (access.provider) {
    case "gemini":
      return {
        url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
        headers: { "x-goog-api-key": access.apiKey ?? "" },
      };
    case "openai":
      return { url: "https://api.openai.com/v1/models", headers: bearer };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models?limit=1",
        headers: { "x-api-key": access.apiKey ?? "", "anthropic-version": ANTHROPIC_VERSION },
      };
    case "openrouter":
      return { url: OPENROUTER_MODELS_URL, headers: bearer };
    case "ollama":
      return access.baseUrl ? { url: `${access.baseUrl}/api/tags`, headers: bearer } : null;
    case "openai_compatible":
      return access.baseUrl ? { url: `${access.baseUrl}/models`, headers: bearer } : null;
  }
}

export async function testAiApiKey(access: AiAccess): Promise<boolean> {
  const probe = probeFor(access);
  if (!probe) return false;
  try {
    const response = await fetch(probe.url, {
      headers: probe.headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
