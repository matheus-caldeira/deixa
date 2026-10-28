"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  closeConversationAction,
  requestConversationReviewAction,
  requestTermCardsAction,
  sendMessageAction,
  type TurnView,
} from "@/app/actions/tutor";
import type { ReviewStatus } from "@/modules/conversations";
import { BackIcon, CheckIcon, LockIcon, MicIcon, PlayIcon, SendIcon, SoundIcon, TurtleIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";
import { useSpeech } from "../shell/use-speech";
import { routes } from "@/shared/routes";
import { loadSpeech } from "@/ui/shell/speech-source";
import { playSource, type Playback } from "../shell/speak";

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
  closed: boolean;
  reviewStatus: ReviewStatus;
  score: number | null;
  difficultyCount: number;
  cardsConfirmed: boolean;
  minTurnsForXp: number;
  conversationXp: number;
};

const MAX_RECORDING_MS = 60_000;
const REVIEW_POLL_MS = 4000;
const REVIEW_STEPS = ["read", "find", "cards", "episodes"] as const;
const STEP_EVERY_MS = 2500;
const WORD_EDGES = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function splitWords(text: string): string[] {
  return text.split(/(\s+)/);
}

function markedPhrases(turns: TurnView[], marks: ReadonlySet<string>): { turnId: string; text: string }[] {
  return turns.flatMap((turn) => {
    const tokens = splitWords(turn.text);
    const phrases: { turnId: string; text: string }[] = [];
    let current: string[] = [];
    tokens.forEach((token, index) => {
      if (/^\s*$/.test(token)) return;
      if (marks.has(`${turn.id}:${index}`)) {
        current.push(token);
        return;
      }
      if (current.length > 0)
        phrases.push({ turnId: turn.id, text: current.join(" ").replace(WORD_EDGES, "") });
      current = [];
    });
    if (current.length > 0)
      phrases.push({ turnId: turn.id, text: current.join(" ").replace(WORD_EDGES, "") });
    return phrases.filter((phrase) => phrase.text !== "");
  });
}

function useConversationPlayer(speed: number, onError: (message: string) => void) {
  const errors = useTranslations("errors");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const cancelled = useRef(false);
  const audio = useRef<Playback | null>(null);

  const stop = useCallback(() => {
    cancelled.current = true;
    audio.current?.stop();
    setPlayingId(null);
  }, []);

  useEffect(() => stop, [stop]);

  const playAll = useCallback(
    async (ids: string[]) => {
      cancelled.current = false;
      for (const id of ids) {
        if (cancelled.current) break;
        setPlayingId(id);
        document.getElementById(`turn-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
        const source = await loadSpeech("turn", id).catch(() => null);
        if (!source) {
          onError(errors("AUDIO_UNAVAILABLE"));
          break;
        }
        const playback = playSource(source, speed);
        audio.current = playback;
        await playback.done;
        if (source.kind === "audio") URL.revokeObjectURL(source.url);
      }
      setPlayingId(null);
    },
    [errors, onError, speed],
  );

  return { playingId, playAll, stop };
}

function ReviewProgress({ status }: { status: ReviewStatus }) {
  const t = useTranslations("chat");
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(
      () => setStep((current) => Math.min(current + 1, REVIEW_STEPS.length - 1)),
      STEP_EVERY_MS,
    );
    return () => clearInterval(timer);
  }, [status]);
  const active = status === "queued" ? -1 : step;
  return (
    <div className="col" style={{ gap: 8, marginTop: 6 }}>
      {REVIEW_STEPS.map((key, index) => (
        <div key={key} className={`pstep ${index < active ? "done" : index === active ? "run" : "wait"}`}>
          <span className="s">{index < active ? <CheckIcon /> : null}</span>
          <span className="small">{t(`steps.${key}`)}</span>
          <span />
        </div>
      ))}
    </div>
  );
}

function ClosedBanner(props: { view: ChatView; onRequestReview: () => void; requesting: boolean }) {
  const t = useTranslations("chat");
  const { view } = props;
  const status = view.reviewStatus;
  const ready = status === "ready";
  return (
    <div className={`closedbar ${ready ? "ready" : status === "failed" ? "failed" : ""}`}>
      <LockIcon />
      <div className="col" style={{ gap: 4, flex: 1, minWidth: 0 }}>
        {status === "queued" || status === "running" ? (
          <>
            <b>{t("reviewRunning")}</b>
            <span className="small muted">{t("reviewRunningBody")}</span>
            <ReviewProgress status={status} />
          </>
        ) : ready ? (
          <>
            <b>{t("reviewReady", { score: view.score ?? 0 })}</b>
            <span className="small muted">
              {view.cardsConfirmed ? t("cardsDone") : t("reviewReadyBody", { count: view.difficultyCount })}
            </span>
            <div className="row" style={{ gap: 14, marginTop: 4, flexWrap: "wrap" }}>
              <Link className="btn sm" href={routes.conversationReview(view.sessionId)}>
                {t("openReview")}
              </Link>
              <Link className="link" href="/series">
                {t("openSeries")}
              </Link>
            </div>
          </>
        ) : (
          <>
            <b>{status === "failed" ? t("reviewFailed") : t("closedNoReview")}</b>
            <span className="small muted">
              {status === "failed" ? t("reviewFailedBody") : t("closedNoReviewBody")}
            </span>
            <div className="row" style={{ gap: 14, marginTop: 4 }}>
              <button className="link" onClick={props.onRequestReview} disabled={props.requesting}>
                {status === "failed" ? t("retryReview") : t("reviewNow")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ChatScreen({ view }: { view: ChatView }) {
  const t = useTranslations("chat");
  const themes = useTranslations("talk");
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [localTurns, setTurns] = useState(view.turns);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<"read" | "listen">("read");
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [marks, setMarks] = useState<Set<string>>(() => new Set());
  const recorder = useRef<MediaRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turns = view.closed ? view.turns : localTurns;
  const speech = useSpeech({ speed: view.audioSpeed, onError: toast });
  const player = useConversationPlayer(view.audioSpeed, toast);
  const userTurns = turns.filter((turn) => turn.role === "user").length;
  const initialUserTurns = view.turns.filter((turn) => turn.role === "user").length;
  const reviewing = view.closed && (view.reviewStatus === "queued" || view.reviewStatus === "running");

  useEffect(() => {
    if (!view.closed) window.scrollTo(0, document.body.scrollHeight);
  }, [turns.length, view.closed]);

  useEffect(() => {
    if (!reviewing) return;
    const timer = setInterval(() => router.refresh(), REVIEW_POLL_MS);
    return () => clearInterval(timer);
  }, [reviewing, router]);

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

  const close = (withReview: boolean) =>
    startTransition(async () => {
      const result = await closeConversationAction({ sessionId: view.sessionId, withReview }).catch(
        () => null,
      );
      setConfirming(false);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      const xp = result.data.xpAwarded;
      toast(withReview ? t("closedReviewQueued", { xp }) : t("closedToast", { xp }));
      router.refresh();
    });

  const requestReview = () =>
    startTransition(async () => {
      const result = await requestConversationReviewAction(view.sessionId).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      toast(t("reviewQueuedToast"));
      router.refresh();
    });

  const createCards = () =>
    startTransition(async () => {
      const phrases = markedPhrases(turns, marks);
      const result = await requestTermCardsAction({ sessionId: view.sessionId, marks: phrases }).catch(
        () => null,
      );
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      setMarks(new Set());
      toast(t("termsQueued", { count: result.data.terms }));
    });

  const toggleMark = (key: string) =>
    setMarks((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const markCount = markedPhrases(turns, marks).length;
  const title = themes.has(`themes.${view.themeId}.title`)
    ? themes(`themes.${view.themeId}.title`)
    : view.title;

  const renderText = (turn: TurnView) => {
    if (!view.closed) return turn.text;
    return splitWords(turn.text).map((token, index) =>
      /^\s*$/.test(token) ? (
        token
      ) : (
        <span
          key={index}
          role="button"
          tabIndex={0}
          className={`w ${marks.has(`${turn.id}:${index}`) ? "mk" : ""}`}
          onClick={() => toggleMark(`${turn.id}:${index}`)}
          onKeyDown={(event) => {
            if (event.key === "Enter") toggleMark(`${turn.id}:${index}`);
          }}
        >
          {token}
        </span>
      ),
    );
  };

  return (
    <div className="chat">
      <div className="lhead" style={{ borderBottom: "1px solid var(--line)" }}>
        <Link className="iconbtn" href="/tutor" aria-label={t("back")}>
          <BackIcon />
        </Link>
        <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <b>{title}</b>
          <span className="small muted">
            {t("header", { accent: t(`accents.${view.accent}`), level: view.level })}
            {view.simulated ? ` · ${t("simulatedTag")}` : ""}
          </span>
        </div>
        {view.closed ? (
          <span className={`chip ${view.reviewStatus === "ready" ? "good" : ""}`}>
            {view.reviewStatus === "ready"
              ? t("closedChipScore", { score: view.score ?? 0 })
              : t("closedChip")}
          </span>
        ) : (
          <button
            className="btn cue sm"
            onClick={() => setConfirming(true)}
            disabled={userTurns === 0 || sending}
          >
            {t("close")}
          </button>
        )}
      </div>
      <div className="msgs">
        {view.closed ? (
          <ClosedBanner view={view} onRequestReview={requestReview} requesting={pending} />
        ) : null}
        {turns.map((turn) => {
          const hidden = view.closed && mode === "listen" && !revealed.has(turn.id);
          const playing = player.playingId === turn.id;
          return (
            <div key={turn.id} style={{ display: "contents" }}>
              <div className={`msgwrap ${turn.role === "tutor" ? "ai" : "me"}`} id={`turn-${turn.id}`}>
                <div
                  className={`msg ${turn.role === "tutor" ? "ai" : "me"} ${hidden ? "hide" : ""} ${playing ? "playing" : ""}`}
                >
                  <span className="txt">{renderText(turn)}</span>
                  {turn.role === "tutor" && turn.translation && !hidden ? (
                    <span className="pt">{turn.translation}</span>
                  ) : null}
                </div>
                {turn.role === "tutor" || view.closed ? (
                  <div className="msgtools">
                    <button onClick={() => speech.play("turn", turn.id)}>
                      <SoundIcon /> {speech.loadingId === turn.id ? t("generating") : t("play")}
                    </button>
                    {view.closed ? (
                      <button onClick={() => speech.play("turn", turn.id, true)}>
                        <TurtleIcon /> {t("slow")}
                      </button>
                    ) : null}
                    {hidden ? (
                      <button onClick={() => setRevealed((current) => new Set(current).add(turn.id))}>
                        {t("showText")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {!hidden && turn.correctedText ? (
                <div className="fix me">
                  <span className="eyebrow">{t("correctedLabel")}</span>
                  <ins>{turn.correctedText}</ins>
                </div>
              ) : null}
              {hidden
                ? null
                : turn.corrections.map((correction, index) => (
                    <div className={`fix ${turn.role === "user" ? "me" : ""}`} key={`${turn.id}-${index}`}>
                      <span className="eyebrow">{t("correction")}</span>
                      <span>
                        <s>{correction.wrong}</s> → <ins>{correction.right}</ins>
                      </span>
                      <span className="small muted">{correction.why}</span>
                    </div>
                  ))}
            </div>
          );
        })}
        {sending ? <div className="msg ai muted">…</div> : null}
      </div>
      {view.closed ? (
        <div className="readfoot">
          <div className="row">
            <div className="seg" style={{ flex: 1 }}>
              <button
                className={mode === "read" ? "on" : ""}
                onClick={() => {
                  setMode("read");
                  setRevealed(new Set());
                }}
              >
                {t("modeRead")}
              </button>
              <button
                className={mode === "listen" ? "on" : ""}
                onClick={() => {
                  setMode("listen");
                  setRevealed(new Set());
                }}
              >
                {t("modeListen")}
              </button>
            </div>
            <button
              className="speak"
              style={{ padding: "10px 14px" }}
              onClick={() =>
                player.playingId ? player.stop() : player.playAll(turns.map((turn) => turn.id))
              }
            >
              <PlayIcon width={18} height={18} />
              {player.playingId ? t("stopAll") : t("playAll")}
            </button>
          </div>
          <div className="row">
            <div style={{ flex: 1 }} className="col">
              <b style={{ fontFamily: "var(--f-display)", fontSize: 22, lineHeight: 1 }}>{markCount}</b>
              <span className="small muted">{t("marked")}</span>
            </div>
            <button className="btn" onClick={createCards} disabled={markCount === 0 || pending}>
              {t("createCards")}
            </button>
          </div>
        </div>
      ) : userTurns >= initialUserTurns + view.turnsLeft ? (
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
      {confirming ? (
        <Sheet label={t("closeTitle")} onClose={() => setConfirming(false)}>
          <h2 style={{ fontSize: 22 }}>{t("closeTitle")}</h2>
          <p className="muted">{t("closeBody")}</p>
          <div className="col" style={{ gap: 10 }}>
            {(["closeStepReview", "closeStepCards", "closeStepSeries"] as const).map((key) => (
              <div className="pstep done" key={key}>
                <span className="s">
                  <CheckIcon />
                </span>
                <span>{t(key)}</span>
                <span />
              </div>
            ))}
          </div>
          <div className="hint">
            <span>
              {userTurns >= view.minTurnsForXp
                ? t("closeXp", { xp: view.conversationXp })
                : t("closeNoXp", { count: view.minTurnsForXp })}
            </span>
          </div>
          <button className="btn cue block" onClick={() => close(true)} disabled={pending}>
            {t("closeAndReview")}
          </button>
          <button className="btn ghost block" onClick={() => close(false)} disabled={pending}>
            {t("closeWithoutReview")}
          </button>
          <button className="link" style={{ alignSelf: "center" }} onClick={() => setConfirming(false)}>
            {t("keepTalking")}
          </button>
        </Sheet>
      ) : null}
    </div>
  );
}
