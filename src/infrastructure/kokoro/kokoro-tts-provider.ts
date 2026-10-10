import type { TtsProvider, Voice } from "@/modules/audio";

const TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 2000;
const MODEL = "kokoro";

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
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Kokoro respondeu ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
