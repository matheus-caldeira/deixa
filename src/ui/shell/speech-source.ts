export type SpeechKind = "cue" | "item" | "turn";

export type SpeechSource = { kind: "audio"; url: string } | { kind: "voice"; text: string; language: string };

export const BUSY_STATUS = 429;

export class SpeechUnavailable extends Error {
  constructor(readonly busy: boolean) {
    super("speech unavailable");
  }
}

export async function loadSpeech(kind: SpeechKind, id: string): Promise<SpeechSource> {
  const response = await fetch(`/api/audio/${kind}/${id}`);
  if (!response.ok) throw new SpeechUnavailable(response.status === BUSY_STATUS);
  return { kind: "audio", url: URL.createObjectURL(await response.blob()) };
}
