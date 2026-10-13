import type { AiAccess } from "./models";

const GOOGLE_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1";
const TIMEOUT_MS = 8000;

export async function testAiApiKey(access: AiAccess): Promise<boolean> {
  try {
    const response = await fetch(GOOGLE_MODELS_URL, {
      headers: { "x-goog-api-key": access.apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
