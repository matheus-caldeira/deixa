import type { SpeechToText } from "../application/transcribe-speech";

export class FakeSpeechToText implements SpeechToText {
  readonly model = "fake";
  calls = 0;

  constructor(private transcript = "I would like a coffee, please.") {}

  say(transcript: string) {
    this.transcript = transcript;
  }

  async transcribe(): Promise<unknown> {
    this.calls += 1;
    return { transcript: this.transcript };
  }
}
