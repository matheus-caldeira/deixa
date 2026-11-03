"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { checkPronunciationAction } from "@/app/actions/pronunciation";
import type { WordCheck } from "@/modules/audio";
import { MicIcon } from "../icons";

const MAX_RECORDING_MS = 15_000;

type Result = { words: WordCheck[]; heard: string; score: number };

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function PronunciationCheck({ itemId }: { itemId: string }) {
  const t = useTranslations("pronunciation");
  const chat = useTranslations("chat");
  const [state, setState] = useState<"idle" | "recording" | "checking">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);

  const check = async (clip: Blob) => {
    setState("checking");
    const outcome = await checkPronunciationAction({
      itemId,
      audio: { mimeType: clip.type, base64: await toBase64(clip) },
    }).catch(() => null);
    setState("idle");
    if (!outcome?.ok) {
      setError(outcome?.message ?? chat("micFailed"));
      return;
    }
    setResult(outcome.data);
  };

  const toggle = async () => {
    if (state === "recording") {
      recorder.current?.stop();
      return;
    }
    setError("");
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(chat("micInsecure"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const instance = new MediaRecorder(stream);
      recorder.current = instance;
      const timer = setTimeout(() => instance.stop(), MAX_RECORDING_MS);
      instance.ondataavailable = (event) => chunks.push(event.data);
      instance.onstop = () => {
        clearTimeout(timer);
        stream.getTracks().forEach((track) => track.stop());
        const clip = new Blob(chunks, { type: instance.mimeType || "audio/webm" });
        if (clip.size > 0) void check(clip);
        else setState("idle");
      };
      instance.start();
      setState("recording");
    } catch {
      setError(chat("micFailed"));
    }
  };

  return (
    <div className="col" style={{ gap: 8 }}>
      <button type="button" className="btn ghost sm" onClick={toggle} disabled={state === "checking"}>
        <MicIcon width={18} height={18} />{" "}
        {state === "recording" ? t("stop") : state === "checking" ? t("checking") : t("speak")}
      </button>
      {result ? (
        <div className="col" style={{ gap: 4 }} data-testid="pronunciation-result">
          <p className="small">
            <b>{t("score", { score: result.score })}</b>{" "}
            {result.words.map((word, index) => (
              <span
                key={`${word.word}-${index}`}
                style={word.heard ? undefined : { color: "var(--bad)", textDecoration: "underline" }}
              >
                {word.word}{" "}
              </span>
            ))}
          </p>
          <p className="small muted">{t("heard", { text: result.heard })}</p>
        </div>
      ) : null}
      {error ? <p className="formerr small">{error}</p> : null}
    </div>
  );
}
