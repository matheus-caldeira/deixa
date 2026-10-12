import type { TtsProvider, Voice } from "@/modules/audio";

const TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 2000;
const MODEL = "kokoro";
const AUDIO_TYPE = "audio/";

export class KokoroTtsProvider implements TtsProvider {
  readonly name = "kokoro" as const;
  readonly modelVersion = "kokoro-v1.0";
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  voiceFor(requested: Voice): Voice {
    return requested;
  }

  async synthesize(input: { text: string; voice: Voice }): Promise<Uint8Array> {
    const response = await fetch(`${this.baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        voice: input.voice.voiceId,
        input: input.text,
        response_format: "wav",
      }),
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Kokoro respondeu ${response.status}`);
    if (!(response.headers.get("content-type") ?? "").startsWith(AUDIO_TYPE)) {
      throw new Error("Kokoro respondeu com um conteúdo que não é áudio");
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        redirect: "error",
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
