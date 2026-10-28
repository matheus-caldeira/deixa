"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadSpeech, SpeechUnavailable, type SpeechKind, type SpeechSource } from "@/ui/shell/speech-source";
import { playSource, type Playback } from "./speak";

const SLOW_FACTOR = 0.6;

export function useSpeech(options: { speed: number; onError: (message: string) => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [readyIds, setReadyIds] = useState<Set<string>>(() => new Set());
  const sources = useRef(new Map<string, SpeechSource>());
  const player = useRef<Playback | null>(null);
  const errors = useTranslations("errors");
  const { speed, onError } = options;

  useEffect(() => {
    const cache = sources.current;
    return () => {
      player.current?.stop();
      for (const source of cache.values()) if (source.kind === "audio") URL.revokeObjectURL(source.url);
      cache.clear();
    };
  }, []);

  const play = useCallback(
    async (kind: SpeechKind, id: string, slow = false) => {
      if (loadingId) return;
      let source = sources.current.get(id);
      if (!source) {
        setLoadingId(id);
        try {
          source = await loadSpeech(kind, id);
          sources.current.set(id, source);
          setReadyIds((current) => new Set(current).add(id));
        } catch (error) {
          const busy = error instanceof SpeechUnavailable && error.busy;
          onError(errors(busy ? "AUDIO_BUSY" : "AUDIO_UNAVAILABLE"));
          return;
        } finally {
          setLoadingId(null);
        }
      }
      player.current?.stop();
      player.current = playSource(source, slow ? speed * SLOW_FACTOR : speed);
    },
    [errors, loadingId, onError, speed],
  );

  return { play, loadingId, readyIds };
}
