import { AppError } from "@/shared/errors";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const FALLBACK_MODELS = ["gemini-flash-latest", "gemini-2.5-flash-lite"];
const KEY_REJECTED = [400, 401, 403];
const TRY_NEXT_MODEL = [404, 429, 500, 503];

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiTurn = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[] };

export type GeminiRequest = {
  apiKey: string;
  model: string;
  system: string;
  turns: GeminiTurn[];
  timeoutMs: number;
  temperature: number;
};

async function callModel(request: GeminiRequest, model: string): Promise<Response> {
  return fetch(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": request.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.turns,
      generationConfig: { responseMimeType: "application/json", temperature: request.temperature },
    }),
    signal: AbortSignal.timeout(request.timeoutMs),
  });
}

export async function generateGeminiJson(request: GeminiRequest): Promise<unknown> {
  const models = [request.model, ...FALLBACK_MODELS.filter((model) => model !== request.model)];
  let lastStatus = 0;
  for (const model of models) {
    let response: Response;
    try {
      response = await callModel(request, model);
    } catch {
      lastStatus = 0;
      continue;
    }
    lastStatus = response.status;
    if (TRY_NEXT_MODEL.includes(response.status)) continue;
    if (KEY_REJECTED.includes(response.status)) {
      throw new AppError("AI_KEY_REJECTED", "O Google recusou a chave de IA. Confira a chave no perfil.");
    }
    if (!response.ok) throw new AppError("LLM_FAILED", `A IA respondeu com erro (${response.status}).`);
    const body = (await response.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    try {
      return JSON.parse(text);
    } catch {
      throw new AppError("LLM_INVALID_OUTPUT", "A IA devolveu uma resposta fora do formato.");
    }
  }
  throw new AppError(
    "LLM_FAILED",
    lastStatus === 429
      ? "A cota diária da chave de IA acabou. Tente de novo amanhã ou use outra chave."
      : "A IA não respondeu. Tente de novo em instantes.",
  );
}

export async function testGeminiApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/models?pageSize=1`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
