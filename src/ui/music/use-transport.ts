"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type YoutubePlayer = {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
};

type YoutubeNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: () => void;
      };
    },
  ) => YoutubePlayer;
};

declare global {
  interface Window {
    YT?: YoutubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export type TransportMode = "loading" | "youtube" | "clock";

const API_URL = "https://www.youtube.com/iframe_api";
const API_TIMEOUT_MS = 8000;
const PLAYING_STATE = 1;
const MS_PER_SECOND = 1000;

let apiPromise: Promise<void> | null = null;

function loadYoutubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = API_URL;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("youtube-api"));
    };
    document.head.appendChild(script);
  });
  return Promise.race([
    apiPromise,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error("youtube-timeout")), API_TIMEOUT_MS)),
  ]);
}

export function useTransport(videoId: string) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const clockRef = useRef({ ms: 0, playing: false, since: 0 });
  const [mode, setMode] = useState<TransportMode>("loading");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let active = true;
    const mount = mountRef.current;
    const fallBack = () => {
      if (!active) return;
      playerRef.current?.destroy();
      playerRef.current = null;
      setPlaying(false);
      setMode("clock");
    };
    loadYoutubeApi()
      .then(() => {
        if (!active || !mount || !window.YT) return;
        const target = document.createElement("div");
        mount.replaceChildren(target);
        playerRef.current = new window.YT.Player(target, {
          videoId,
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
          events: {
            onReady: () => {
              if (active) setMode("youtube");
            },
            onStateChange: (event) => {
              if (active) setPlaying(event.data === PLAYING_STATE);
            },
            onError: fallBack,
          },
        });
      })
      .catch(fallBack);
    return () => {
      active = false;
      playerRef.current?.destroy();
      playerRef.current = null;
      mount?.replaceChildren();
    };
  }, [videoId]);

  const currentMs = useCallback((): number => {
    if (playerRef.current && mode === "youtube") {
      return playerRef.current.getCurrentTime() * MS_PER_SECOND;
    }
    const clock = clockRef.current;
    return clock.playing ? clock.ms + (performance.now() - clock.since) : clock.ms;
  }, [mode]);

  const seekMs = useCallback(
    (ms: number) => {
      const target = Math.max(0, ms);
      if (playerRef.current && mode === "youtube") {
        playerRef.current.seekTo(target / MS_PER_SECOND, true);
        return;
      }
      clockRef.current = { ...clockRef.current, ms: target, since: performance.now() };
    },
    [mode],
  );

  const play = useCallback(() => {
    if (playerRef.current && mode === "youtube") {
      playerRef.current.playVideo();
      return;
    }
    clockRef.current = { ms: currentMs(), playing: true, since: performance.now() };
    setPlaying(true);
  }, [mode, currentMs]);

  const pause = useCallback(() => {
    if (playerRef.current && mode === "youtube") {
      playerRef.current.pauseVideo();
      return;
    }
    clockRef.current = { ms: currentMs(), playing: false, since: performance.now() };
    setPlaying(false);
  }, [mode, currentMs]);

  return { mountRef, mode, playing, currentMs, seekMs, play, pause };
}
