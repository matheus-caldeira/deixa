import { describe, expect, it } from "vitest";
import { FakeSpeechToText } from "../infrastructure/fake-speech-to-text";
import { makeTranscribeSpeech, MAX_SPEECH_BYTES } from "./transcribe-speech";

const clip = (bytes = 10, mimeType = "audio/webm;codecs=opus") => ({
  mimeType,
  bytes: new Uint8Array(bytes),
});

describe("transcrever a fala", () => {
  it("devolve o texto limpo da transcrição", async () => {
    const transcriber = new FakeSpeechToText("  I'd like a coffee.  ");
    const transcribe = makeTranscribeSpeech({ resolveTranscriber: async () => transcriber });
    expect(await transcribe({ userId: "u1", clip: clip(), language: "en" })).toEqual({
      text: "I'd like a coffee.",
    });
  });

  it("recusa áudio vazio, grande demais ou de tipo errado sem chamar a IA", async () => {
    const transcriber = new FakeSpeechToText();
    const transcribe = makeTranscribeSpeech({ resolveTranscriber: async () => transcriber });
    for (const bad of [clip(0), clip(MAX_SPEECH_BYTES + 1), clip(10, "video/mp4")]) {
      await expect(transcribe({ userId: "u1", clip: bad, language: "en" })).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
    }
    expect(transcriber.calls).toBe(0);
  });

  it("sem IA configurada ou sem fala inteligível vira erro tratável", async () => {
    const none = makeTranscribeSpeech({ resolveTranscriber: async () => null });
    await expect(none({ userId: "u1", clip: clip(), language: "en" })).rejects.toMatchObject({
      code: "LLM_FAILED",
    });
    const silent = makeTranscribeSpeech({ resolveTranscriber: async () => new FakeSpeechToText("") });
    await expect(silent({ userId: "u1", clip: clip(), language: "en" })).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });
  });
});
