"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechKind = "cue" | "item";
const BUSY = 429;

export function useSpeech(options: { speed: number; onError: (message: string) => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [readyIds, setReadyIds] = useState<Set<string>>(() => new Set());
  const urls = useRef(new Map<string, string>());
  const player = useRef<HTMLAudioElement | null>(null);
  const { speed, onError } = options;

  useEffect(() => {
    const cache = urls.current;
    return () => {
      player.current?.pause();
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  const play = useCallback(
    async (kind: SpeechKind, id: string, slow = false) => {
      if (loadingId) return;
      let url = urls.current.get(id);
      if (!url) {
        setLoadingId(id);
        try {
          const response = await fetch(`/api/audio/${kind}/${id}`);
          if (!response.ok) {
            onError(
              response.status === BUSY
                ? "Já estamos gerando outros áudios para você. Tente de novo em instantes."
                : "Não foi possível gerar o áudio agora.",
            );
            return;
          }
          url = URL.createObjectURL(await response.blob());
          urls.current.set(id, url);
          setReadyIds((current) => new Set(current).add(id));
        } catch {
          onError("Não foi possível gerar o áudio agora.");
          return;
        } finally {
          setLoadingId(null);
        }
      }
      player.current?.pause();
      const audio = new Audio(url);
      audio.playbackRate = slow ? speed * 0.6 : speed;
      player.current = audio;
      audio.play().catch(() => undefined);
    },
    [loadingId, onError, speed],
  );

  return { play, loadingId, readyIds };
}
