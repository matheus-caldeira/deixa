"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { reviewConversationAction, sendMessageAction, type TurnView } from "@/app/actions/tutor";
import type { ConversationReview } from "@/modules/conversations";
import { BackIcon, MicIcon, SendIcon, SoundIcon, TargetIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";
import { useSpeech } from "../shell/use-speech";

export type ChatView = {
  sessionId: string;
  themeId: string;
  title: string;
  level: string;
  accent: "US" | "UK";
  audioSpeed: number;
  simulated: boolean;
  turnsLeft: number;
  turns: TurnView[];
  review: ConversationReview | null;
};

const MAX_RECORDING_MS = 60_000;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function ChatScreen({ view }: { view: ChatView }) {
  const t = useTranslations("chat");
  const themes = useTranslations("talk");
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const [turns, setTurns] = useState(view.turns);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [review, setReview] = useState(view.review);
  const [showReview, setShowReview] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speech = useSpeech({ speed: view.audioSpeed, onError: toast });
  const userTurns = turns.filter((turn) => turn.role === "user").length;
  const initialUserTurns = view.turns.filter((turn) => turn.role === "user").length;

  useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, [turns.length]);

  const deliver = async (payload: { text?: string; audio?: { mimeType: string; base64: string } }) => {
    setSending(true);
    const result = await sendMessageAction({ sessionId: view.sessionId, ...payload }).catch(() => null);
    setSending(false);
    if (!result) {
      toast(errorText(null));
      return false;
    }
    if (!result.ok) {
      toast(result.message);
      return false;
    }
    setTurns((current) => [...current, result.data.userTurn, result.data.tutorTurn]);
    if (result.data.queuedForReview > 0) toast(t("queued", { count: result.data.queuedForReview }));
    return true;
  };

  const sendText = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setText("");
    if (!(await deliver({ text: message }))) setText(message);
  };

  const toggleRecording = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast(t("micInsecure"));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const instance = new MediaRecorder(stream);
      recorder.current = instance;
      instance.ondataavailable = (event) => chunks.push(event.data);
      instance.onstop = async () => {
        if (stopTimer.current) clearTimeout(stopTimer.current);
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: instance.mimeType || "audio/webm" });
        if (blob.size > 0) await deliver({ audio: { mimeType: blob.type, base64: await toBase64(blob) } });
      };
      instance.start();
      setRecording(true);
      stopTimer.current = setTimeout(() => instance.stop(), MAX_RECORDING_MS);
    } catch {
      toast(t("micFailed"));
    }
  };

  const runReview = async () => {
    setShowReview(true);
    if (reviewing) return;
    setReviewing(true);
    const result = await reviewConversationAction(view.sessionId).catch(() => null);
    setReviewing(false);
    if (!result?.ok) {
      toast(result?.message ?? errorText(null));
      if (!review) setShowReview(false);
      return;
    }
    setReview(result.data.review);
    if (result.data.xpAwarded > 0) toast(t("reviewedXp", { xp: result.data.xpAwarded }));
    router.refresh();
  };

  return (
    <div className="chat">
      <div className="lhead" style={{ borderBottom: "1px solid var(--line)" }}>
        <Link className="iconbtn" href="/tutor" aria-label={t("back")}>
          <BackIcon />
        </Link>
        <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <b>
            {themes.has(`themes.${view.themeId}.title`) ? themes(`themes.${view.themeId}.title`) : view.title}
          </b>
          <span className="small muted">
            {t("header", { accent: t(`accents.${view.accent}`), level: view.level })}
            {view.simulated ? ` · ${t("simulatedTag")}` : ""}
          </span>
        </div>
        <button
          className="playbtn"
          onClick={runReview}
          disabled={userTurns === 0}
          aria-label={t("reviewAll")}
          title={t("reviewAll")}
        >
          <TargetIcon />
        </button>
      </div>
      <div className="msgs">
        {turns.map((turn) => (
          <div key={turn.id} style={{ display: "contents" }}>
            {turn.role === "tutor" ? (
              <div
                className="msg ai"
                role="button"
                tabIndex={0}
                onClick={() => speech.play("turn", turn.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") speech.play("turn", turn.id);
                }}
              >
                {turn.text}
                {turn.translation ? <span className="pt">{turn.translation}</span> : null}
                <span className="pt" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <SoundIcon width={14} height={14} />{" "}
                  {speech.loadingId === turn.id ? t("generating") : t("play")}
                </span>
              </div>
            ) : (
              <div className="msg me">{turn.text}</div>
            )}
            {turn.corrections.map((correction, index) => (
              <div className="fix" key={`${turn.id}-${index}`}>
                <span className="eyebrow">{t("correction")}</span>
                <span>
                  <s>{correction.wrong}</s> → <ins>{correction.right}</ins>
                </span>
                <span className="small muted">{correction.why}</span>
              </div>
            ))}
          </div>
        ))}
        {sending ? <div className="msg ai muted">…</div> : null}
      </div>
      {userTurns >= initialUserTurns + view.turnsLeft ? (
        <p className="small muted" style={{ padding: "0 16px 16px" }}>
          {t("limitReached")}
        </p>
      ) : (
        <form className="composer" onSubmit={sendText}>
          <button
            className="playbtn"
            type="button"
            onClick={toggleRecording}
            disabled={sending}
            style={
              recording
                ? { background: "var(--bad)", boxShadow: "0 3px 0 var(--line)" }
                : { background: "var(--surface)", color: "var(--brand)", boxShadow: "0 3px 0 var(--line)" }
            }
            aria-label={recording ? t("stopRecording") : t("recordAnswer")}
          >
            <MicIcon />
          </button>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={recording ? t("recording") : t("answerPlaceholder")}
            autoComplete="off"
            maxLength={500}
            disabled={recording}
            aria-label={t("yourMessage")}
          />
          <button
            className="playbtn"
            type="submit"
            disabled={sending || text.trim() === ""}
            aria-label={t("send")}
          >
            <SendIcon />
          </button>
        </form>
      )}
      {showReview ? (
        <Sheet label={t("reviewTitle")} onClose={() => setShowReview(false)}>
          <h2 style={{ fontSize: 22 }}>{t("reviewTitle")}</h2>
          {reviewing && !review ? (
            <div className="pstep run">
              <span className="s" />
              <span>{t("evaluating")}</span>
              <span />
            </div>
          ) : null}
          {review ? (
            <>
              <div className="card goalrow">
                <b style={{ fontFamily: "var(--f-display)", fontSize: 34, lineHeight: 1 }}>{review.score}</b>
                <p className="small">{review.summary}</p>
              </div>
              {review.strengths.length > 0 ? (
                <div className="col">
                  <span className="eyebrow">{t("strengths")}</span>
                  {review.strengths.map((item) => (
                    <span key={item} className="chip good" style={{ whiteSpace: "normal", borderRadius: 12 }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {review.improvements.length > 0 ? (
                <div className="col">
                  <span className="eyebrow">{t("improvements")}</span>
                  {review.improvements.map((item) => (
                    <span key={item} className="chip warn" style={{ whiteSpace: "normal", borderRadius: 12 }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {review.phrases.length > 0 ? (
                <div className="col">
                  <span className="eyebrow">{t("phrasesQueued")}</span>
                  {review.phrases.map((phrase, index) => (
                    <div className="fix" key={index} style={{ maxWidth: "100%" }}>
                      <span>
                        <s>{phrase.wrong}</s> → <ins>{phrase.right}</ins>
                      </span>
                      <span className="small muted">{phrase.why}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <button className="btn ghost wide" onClick={runReview} disabled={reviewing}>
                {reviewing ? t("evaluatingShort") : t("evaluateAgain")}
              </button>
            </>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  );
}
