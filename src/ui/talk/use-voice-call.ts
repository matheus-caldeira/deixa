"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadSpeech } from "@/ui/shell/speech-source";
import { playSource, type Playback } from "../shell/speak";
import {
  MIN_SPEECH_MS,
  nextActivity,
  QUIET,
  rmsOf,
  SPEECH_LEVEL,
  type VoiceActivity,
} from "./voice-activity";

export type CallPhase = "off" | "listening" | "thinking" | "speaking";

const MAX_TURN_MS = 60_000;
const BARGE_IN_FACTOR = 2;
const FFT_SIZE = 2048;

type Session = {
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  samples: Float32Array<ArrayBuffer>;
  frame: number | null;
  recorder: MediaRecorder | null;
  playback: Playback | null;
  active: boolean;
};

type EngineOptions = {
  speed: number;
  send: (clip: Blob) => Promise<string | null>;
  onPhase: (phase: CallPhase) => void;
};

function level(current: Session): number {
  current.analyser.getFloatTimeDomainData(current.samples);
  return rmsOf(current.samples);
}

function watch(current: Session, onFrame: (value: number, elapsedMs: number) => boolean) {
  let last = performance.now();
  const tick = (now: number) => {
    if (!current.active) return;
    const keepGoing = onFrame(level(current), now - last);
    last = now;
    current.frame = keepGoing ? requestAnimationFrame(tick) : null;
  };
  current.frame = requestAnimationFrame(tick);
}

async function respond(current: Session, options: EngineOptions, chunks: Blob[], mimeType: string) {
  const clip = new Blob(chunks, { type: mimeType || "audio/webm" });
  options.onPhase("thinking");
  const turnId = clip.size > 0 ? await options.send(clip) : null;
  if (!current.active) return;
  const source = turnId ? await loadSpeech("turn", turnId).catch(() => null) : null;
  if (!current.active) return;
  if (source) {
    options.onPhase("speaking");
    const playback = playSource(source, options.speed);
    current.playback = playback;
    let loudMs = 0;
    watch(current, (value, elapsed) => {
      loudMs = value >= SPEECH_LEVEL * BARGE_IN_FACTOR ? loudMs + elapsed : 0;
      if (loudMs < MIN_SPEECH_MS) return current.playback === playback;
      playback.stop();
      return false;
    });
    await playback.done;
    current.playback = null;
  }
  listen(current, options);
}

function listen(current: Session, options: EngineOptions) {
  if (!current.active) return;
  options.onPhase("listening");
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(current.stream);
  current.recorder = recorder;
  recorder.ondataavailable = (event) => chunks.push(event.data);
  recorder.onstop = () => {
    current.recorder = null;
    if (current.active) void respond(current, options, chunks, recorder.mimeType);
  };
  recorder.start();
  let activity: VoiceActivity = QUIET;
  let totalMs = 0;
  watch(current, (value, elapsed) => {
    const next = nextActivity(activity, value, elapsed);
    activity = next.state;
    totalMs += elapsed;
    if (!next.finished && totalMs < MAX_TURN_MS) return true;
    recorder.stop();
    return false;
  });
}

function close(current: Session) {
  current.active = false;
  if (current.frame !== null) cancelAnimationFrame(current.frame);
  current.playback?.stop();
  if (current.recorder?.state === "recording") current.recorder.stop();
  current.stream.getTracks().forEach((track) => track.stop());
  void current.context.close().catch(() => undefined);
}

async function open(options: EngineOptions): Promise<Session> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  context.createMediaStreamSource(stream).connect(analyser);
  const current: Session = {
    stream,
    context,
    analyser,
    samples: new Float32Array(FFT_SIZE),
    frame: null,
    recorder: null,
    playback: null,
    active: true,
  };
  listen(current, options);
  return current;
}

export function useVoiceCall(options: {
  speed: number;
  send: (clip: Blob) => Promise<string | null>;
  onError: (message: string) => void;
  messages: { insecure: string; failed: string };
}) {
  const [phase, setPhase] = useState<CallPhase>("off");
  const session = useRef<Session | null>(null);
  const { speed, send, onError, messages } = options;

  const stop = useCallback(() => {
    const current = session.current;
    session.current = null;
    setPhase("off");
    if (current) close(current);
  }, []);

  const start = useCallback(async () => {
    if (session.current) return;
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      onError(messages.insecure);
      return;
    }
    try {
      session.current = await open({ speed, send, onPhase: setPhase });
    } catch {
      onError(messages.failed);
      stop();
    }
  }, [messages, onError, send, speed, stop]);

  useEffect(() => stop, [stop]);

  return { phase, start, stop };
}
