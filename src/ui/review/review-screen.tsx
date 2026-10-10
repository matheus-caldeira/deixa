"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { gradeCardAction } from "@/app/actions/review";
import { RATINGS, RATING_LABELS, type Rating } from "@/modules/flashcards";
import { CheckIcon, SoundIcon } from "../icons";
import { useToast } from "../shell/toast";
import { useSpeech } from "../shell/use-speech";

export type ReviewCard = {
  cardId: string;
  learningItemId: string;
  term: string;
  meaning: string;
  contextText: string | null;
  contextTranslation: string | null;
  sourceLabel: string;
  intervals: Record<Rating, string>;
};

export type ReviewView = {
  cards: ReviewCard[];
  dueCount: number;
  audioSpeed: number;
  recurringErrors: { label: string; count: string }[];
};

export function ReviewScreen({ view }: { view: ReviewView }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dueCount, setDueCount] = useState(view.dueCount);
  const [earned, setEarned] = useState(0);
  const speech = useSpeech({ speed: view.audioSpeed, onError: toast });
  const card = view.cards[index];

  const grade = (rating: Rating) => {
    if (!card) return;
    startTransition(async () => {
      const result = await gradeCardAction({ cardId: card.cardId, rating });
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setDueCount(result.data.dueCount);
      setEarned((total) => total + result.data.xpAwarded);
      setFlipped(false);
      setIndex((current) => current + 1);
      router.refresh();
    });
  };

  const errors =
    view.recurringErrors.length > 0 ? (
      <section className="card col" style={{ gap: 4 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 17 }}>Erros recorrentes</h2>
        </div>
        {view.recurringErrors.map((entry) => (
          <div className="dueitem" key={entry.label}>
            <span>{entry.label}</span>
            <span className="chip bad">{entry.count}</span>
          </div>
        ))}
      </section>
    ) : null;

  if (!card) {
    const reviewed = index;
    return (
      <>
        <h1 style={{ fontSize: 28, paddingTop: 4 }}>Revisar</h1>
        <div
          className="card col"
          style={{ alignItems: "center", textAlign: "center", gap: 12, padding: "28px 16px" }}
        >
          <div style={{ width: 56, height: 56, color: "var(--good)" }}>
            <CheckIcon />
          </div>
          <h2>Fila em dia</h2>
          <p className="muted">
            {reviewed > 0
              ? `Você revisou ${reviewed} cartões e ganhou ${earned} XP.`
              : "Nenhum cartão vencido agora. Leia um episódio e marque o que não entendeu para criar novos."}
            {dueCount > 0 ? ` Ainda há ${dueCount} na fila.` : ""}
          </p>
          {dueCount > 0 ? (
            <button
              className="btn ghost"
              onClick={() => {
                setIndex(0);
                router.refresh();
              }}
            >
              Continuar revisando
            </button>
          ) : null}
        </div>
        {errors}
      </>
    );
  }

  return (
    <>
      <div className="sec-h" style={{ paddingTop: 4 }}>
        <h1 style={{ fontSize: 28 }}>Revisar</h1>
        <span className="chip mono">
          {index + 1}/{view.cards.length} · {dueCount} na fila
        </span>
      </div>
      <div className="bar good">
        <i style={{ width: `${(index / view.cards.length) * 100}%` }} />
      </div>
      <div className={`flash ${flipped ? "flip" : ""}`}>
        <div className="inner">
          <div className="face" aria-hidden={flipped}>
            <span className="eyebrow">{card.sourceLabel}</span>
            <div className="en">{card.term}</div>
            <button
              className="speak"
              style={{ alignSelf: "flex-start" }}
              onClick={() => speech.play("item", card.learningItemId)}
              tabIndex={flipped ? -1 : 0}
            >
              <SoundIcon /> {speech.loadingId === card.learningItemId ? "Gerando…" : "Ouvir"}
            </button>
            {card.contextText && card.contextText !== card.term ? (
              <div className="ctxline">
                <span>{card.contextText}</span>
              </div>
            ) : null}
            <span className="spacer" />
            <p className="small muted">Lembre o significado antes de virar.</p>
          </div>
          <div className="face back" aria-hidden={!flipped}>
            <span className="eyebrow">{card.sourceLabel}</span>
            <div className="en" style={{ fontSize: 20 }}>
              {card.term}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--brand)" }}>{card.meaning}</div>
            {card.contextText && card.contextText !== card.term ? (
              <div className="ctxline">
                <span>{card.contextText}</span>
                {card.contextTranslation ? <span className="muted">{card.contextTranslation}</span> : null}
              </div>
            ) : null}
            <span className="spacer" />
            <p className="small muted">Quanto você lembrou?</p>
          </div>
        </div>
      </div>
      {flipped ? (
        <div className="grades">
          {RATINGS.map((rating, position) => (
            <button
              key={rating}
              className={`grade g${position + 1}`}
              onClick={() => grade(rating)}
              disabled={pending}
            >
              {RATING_LABELS[rating]}
              <small>{card.intervals[rating]}</small>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn wide" onClick={() => setFlipped(true)}>
          Mostrar resposta
        </button>
      )}
      {errors}
    </>
  );
}
