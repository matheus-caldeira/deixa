import { silentWav, type Voice } from "../domain/speech";
import type { TtsProvider } from "../application/ports";

const SILENCE_MS = 300;

export class SilentTtsProvider implements TtsProvider {
  readonly name = "silent" as const;
  readonly modelVersion = "silent-1";
  calls = 0;

  voiceFor(requested: Voice): Voice {
    return { voiceId: "silent", language: requested.language };
  }

  async synthesize(): Promise<Uint8Array> {
    this.calls += 1;
    return silentWav(SILENCE_MS);
  }
}
