export const SPEECH_LEVEL = 0.04;
export const SILENCE_MS = 1_200;
export const MIN_SPEECH_MS = 300;

export type VoiceActivity = { speaking: boolean; speechMs: number; silenceMs: number };

export const QUIET: VoiceActivity = { speaking: false, speechMs: 0, silenceMs: 0 };

export function rmsOf(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return samples.length === 0 ? 0 : Math.sqrt(sum / samples.length);
}

export function nextActivity(
  state: VoiceActivity,
  level: number,
  elapsedMs: number,
): { state: VoiceActivity; finished: boolean } {
  if (level >= SPEECH_LEVEL) {
    return { state: { speaking: true, speechMs: state.speechMs + elapsedMs, silenceMs: 0 }, finished: false };
  }
  if (!state.speaking) return { state, finished: false };
  const silenceMs = state.silenceMs + elapsedMs;
  const finished = silenceMs >= SILENCE_MS && state.speechMs >= MIN_SPEECH_MS;
  return { state: { ...state, silenceMs }, finished };
}
