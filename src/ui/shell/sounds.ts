"use client";

type Tone = { frequency: number; startS: number; durationS: number; type: OscillatorType; volume: number };

const SOUNDS = {
  select: [{ frequency: 660, startS: 0, durationS: 0.06, type: "sine", volume: 0.05 }],
  right: [
    { frequency: 660, startS: 0, durationS: 0.11, type: "triangle", volume: 0.12 },
    { frequency: 990, startS: 0.09, durationS: 0.18, type: "triangle", volume: 0.12 },
  ],
  wrong: [
    { frequency: 300, startS: 0, durationS: 0.14, type: "sine", volume: 0.12 },
    { frequency: 220, startS: 0.12, durationS: 0.22, type: "sine", volume: 0.12 },
  ],
} satisfies Record<string, Tone[]>;

export type SoundName = keyof typeof SOUNDS;

const ATTACK_S = 0.01;
const SILENT_GAIN = 0.0001;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  context ??= new window.AudioContext();
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

export function playSound(name: SoundName): void {
  try {
    const audio = audioContext();
    if (!audio) return;
    const now = audio.currentTime;
    for (const tone of SOUNDS[name]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = now + tone.startS;
      const end = start + tone.durationS;
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      gain.gain.setValueAtTime(SILENT_GAIN, start);
      gain.gain.exponentialRampToValueAtTime(tone.volume, start + ATTACK_S);
      gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, end);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(end + ATTACK_S);
    }
  } catch {
    return;
  }
}
