"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { reviewConversationAction, sendMessageAction, type TurnView } from "@/app/actions/tutor";
import type { ConversationReview } from "@/modules/conversations";
import { BackIcon, MicIcon, SendIcon, SoundIcon, TargetIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { useSpeech } from "../shell/use-speech";

export type ChatView = {
  sessionId: string;
  title: string;
  level: string;
  accentLabel: string;
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
      toast("Não deu para falar com o servidor. Tente de novo.");
      return false;
    }
    if (!result.ok) {
      toast(result.message);
      return false;
    }
    setTurns((current) => [...current, result.data.userTurn, result.data.tutorTurn]);
    if (result.data.queuedForReview > 0)
      toast(`${result.data.queuedForReview} correção(ões) na sua revisão.`);
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
      toast("O microfone só funciona em conexão segura (HTTPS). Por enquanto, escreva sua resposta.");
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
      toast("Não foi possível usar o microfone.");
    }
  };

  const runReview = async () => {
    setShowReview(true);
    if (reviewing) return;
    setReviewing(true);
    const result = await reviewConversationAction(view.sessionId).catch(() => null);
    setReviewing(false);
    if (!result?.ok) {
      toast(result?.message ?? "Não deu para falar com o servidor.");
      if (!review) setShowReview(false);
      return;
    }
    setReview(result.data.review);
    if (result.data.xpAwarded > 0) toast(`Conversa revisada · +${result.data.xpAwarded} XP`);
    router.refresh();
  };

  return (
    <div className="chat">
      <div className="lhead" style={{ borderBottom: "1px solid var(--line)" }}>
        <Link className="iconbtn" href="/tutor" aria-label="Voltar">
          <BackIcon />
        </Link>
        <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <b>{view.title}</b>
          <span className="small muted">
            Tutor · {view.accentLabel} · nível {view.level}
            {view.simulated ? " · simulado" : ""}
          </span>
        </div>
        <button
          className="playbtn"
          onClick={runReview}
          disabled={userTurns === 0}
          aria-label="Revisar a conversa inteira"
          title="Revisar a conversa inteira"
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
                  <SoundIcon width={14} height={14} /> {speech.loadingId === turn.id ? "gerando…" : "tocar"}
                </span>
              </div>
            ) : (
              <div className="msg me">{turn.text}</div>
            )}
            {turn.corrections.map((correction, index) => (
              <div className="fix" key={`${turn.id}-${index}`}>
                <span className="eyebrow">Correção</span>
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
          Esta conversa chegou ao limite. Toque no alvo para revisar e comece outra.
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
            aria-label={recording ? "Parar e enviar o áudio" : "Responder por áudio"}
          >
            <MicIcon />
          </button>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={recording ? "Gravando… toque no microfone para enviar" : "Responda em inglês…"}
            autoComplete="off"
            maxLength={500}
            disabled={recording}
            aria-label="Sua mensagem"
          />
          <button
            className="playbtn"
            type="submit"
            disabled={sending || text.trim() === ""}
            aria-label="Enviar"
          >
            <SendIcon />
          </button>
        </form>
      )}
      {showReview ? (
        <Sheet label="Revisão da conversa" onClose={() => setShowReview(false)}>
          <h2 style={{ fontSize: 22 }}>Revisão da conversa</h2>
          {reviewing && !review ? (
            <div className="pstep run">
              <span className="s" />
              <span>Avaliando a conversa inteira…</span>
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
                  <span className="eyebrow">O que foi bem</span>
                  {review.strengths.map((item) => (
                    <span key={item} className="chip good" style={{ whiteSpace: "normal", borderRadius: 12 }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {review.improvements.length > 0 ? (
                <div className="col">
                  <span className="eyebrow">Para melhorar</span>
                  {review.improvements.map((item) => (
                    <span key={item} className="chip warn" style={{ whiteSpace: "normal", borderRadius: 12 }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {review.phrases.length > 0 ? (
                <div className="col">
                  <span className="eyebrow">Frases que foram para a sua revisão</span>
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
                {reviewing ? "Avaliando…" : "Avaliar de novo"}
              </button>
            </>
          ) : null}
        </Sheet>
      ) : null}
    </div>
  );
}
