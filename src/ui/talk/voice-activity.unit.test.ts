import { describe, expect, it } from "vitest";
import { nextActivity, QUIET, rmsOf, SILENCE_MS, SPEECH_LEVEL, type VoiceActivity } from "./voice-activity";

const FRAME_MS = 100;

function run(levels: number[]): { state: VoiceActivity; finishedAt: number | null } {
  let state = QUIET;
  for (const [index, level] of levels.entries()) {
    const next = nextActivity(state, level, FRAME_MS);
    state = next.state;
    if (next.finished) return { state, finishedAt: index };
  }
  return { state, finishedAt: null };
}

describe("detector de fala da chamada", () => {
  it("só fecha a fala depois de voz seguida de silêncio longo", () => {
    const voice = Array(5).fill(SPEECH_LEVEL * 2);
    const silence = Array(SILENCE_MS / FRAME_MS + 2).fill(0);
    expect(run([...voice, ...silence]).finishedAt).toBe(voice.length + SILENCE_MS / FRAME_MS - 1);
  });

  it("silêncio sem fala antes não fecha nada", () => {
    expect(run(Array(40).fill(0)).finishedAt).toBeNull();
  });

  it("um estalo curto não conta como fala", () => {
    expect(run([SPEECH_LEVEL * 2, ...Array(30).fill(0)]).finishedAt).toBeNull();
  });

  it("calcula a energia do sinal", () => {
    expect(rmsOf(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    expect(rmsOf(new Float32Array())).toBe(0);
  });
});
