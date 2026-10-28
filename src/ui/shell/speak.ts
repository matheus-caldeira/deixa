import type { SpeechSource } from "@/ui/shell/speech-source";

const VOICE_LANGUAGES: Record<string, string> = { en: "en-US", "pt-BR": "pt-BR", es: "es-ES", fr: "fr-FR" };

export type Playback = { done: Promise<void>; stop: () => void };

export function playSource(source: SpeechSource, rate: number): Playback {
  if (source.kind === "audio") {
    const audio = new Audio(source.url);
    audio.playbackRate = rate;
    const done = new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.onpause = () => resolve();
    });
    audio.play().catch(() => undefined);
    return { done, stop: () => audio.pause() };
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(source.text);
  utterance.lang = VOICE_LANGUAGES[source.language] ?? source.language;
  utterance.rate = rate;
  const done = new Promise<void>((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
  });
  speechSynthesis.speak(utterance);
  return { done, stop: () => speechSynthesis.cancel() };
}
