import { sha256Hex } from "@/shared/hash";

export type Accent = "US" | "UK";
export type Voice = { voiceId: string; language: string };

export const VOICE_BY_ACCENT: Record<Accent, Voice> = {
  US: { voiceId: "af_heart", language: "en-us" },
  UK: { voiceId: "bf_emma", language: "en-gb" },
};

export const MAX_SPEECH_TEXT_LENGTH = 500;
const WAV_HEADER_BYTES = 44;
const SILENT_SAMPLE_RATE = 8000;
const BYTES_PER_SAMPLE = 2;
const PCM_FORMAT = 1;
const MONO = 1;
const BITS_PER_SAMPLE = 16;

export function normalizeSpeechText(text: string): string {
  return text.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().slice(0, MAX_SPEECH_TEXT_LENGTH);
}

export function audioHash(input: {
  text: string;
  voiceId: string;
  language: string;
  modelVersion: string;
}): string {
  return sha256Hex(
    [normalizeSpeechText(input.text).toLowerCase(), input.voiceId, input.language, input.modelVersion].join(
      "|",
    ),
  );
}

export function audioStoragePath(voiceId: string, hash: string): string {
  return `audio/${voiceId}/${hash}.wav`;
}

export function silentWav(durationMs: number): Uint8Array {
  const sampleCount = Math.round((SILENT_SAMPLE_RATE * durationMs) / 1000);
  const dataBytes = sampleCount * BYTES_PER_SAMPLE;
  const buffer = Buffer.alloc(WAV_HEADER_BYTES + dataBytes);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(WAV_HEADER_BYTES - 8 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(PCM_FORMAT, 20);
  buffer.writeUInt16LE(MONO, 22);
  buffer.writeUInt32LE(SILENT_SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SILENT_SAMPLE_RATE * BYTES_PER_SAMPLE, 28);
  buffer.writeUInt16LE(BYTES_PER_SAMPLE, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
  return new Uint8Array(buffer);
}

export function looksLikeWav(bytes: Uint8Array): boolean {
  return bytes.length > WAV_HEADER_BYTES && Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF";
}
