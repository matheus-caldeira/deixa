"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { anticipateReviewAction, gradeCardAction } from "@/app/actions/review";
import { RATINGS, type Interval, type Rating } from "@/modules/flashcards";
import { CheckIcon, SoundIcon } from "../icons";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";
import { useSpeech } from "../shell/use-speech";

export type ReviewCard = {
  cardId: string;
  learningItemId: string;
  term: string;
  meaning: string;
  contextText: string | null;
  contextTranslation: string | null;
  source: {
    mediaTitle: string | null;
    mediaType: "series" | "movie" | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    sourceKind: string;
  };
  intervals: Record<Rating, Interval>;
};

export type ReviewView = {
  cards: ReviewCard[];
  dueCount: number;
  anticipation: { available: boolean; batchSize: number };
  audioSpeed: number;
};

export function ReviewScreen({ view }: { view: ReviewView }) {
  const t = useTranslations("review");
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dueCount, setDueCount] = useState(view.dueCount);
  const [earned, setEarned] = useState(0);
  const speech = useSpeech({ speed: view.audioSpeed, onError: toast });
  const card = view.cards[index];

  const sourceLabel = (source: ReviewCard["source"]): string => {
    const episode =
      source.mediaType === "movie"
        ? t("movie")
        : source.seasonNumber !== null && source.episodeNumber !== null
          ? t("seasonEpisode", { season: source.seasonNumber, episode: source.episodeNumber })
          : null;
    const suffix = t.has(`sources.${source.sourceKind}`) ? t(`sources.${source.sourceKind}`) : null;
    return [source.mediaTitle, episode, suffix].filter((part) => part).join(" · ") || t("title");
  };
  const intervalLabel = (interval: Interval): string =>
    t(`interval.${interval.unit}`, { count: interval.value });

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
      if (index + 1 >= view.cards.length) router.refresh();
    });
  };

  const anticipate = () =>
    startTransition(async () => {
      const result = await anticipateReviewAction().catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      toast(t("anticipated", { count: result.data.moved }));
      router.refresh();
    });

  if (!card) {
    const reviewed = index;
    return (
      <>
        <h1 style={{ fontSize: 28, paddingTop: 4 }}>{t("title")}</h1>
        <div
          className="card col"
          style={{ alignItems: "center", textAlign: "center", gap: 12, padding: "28px 16px" }}
        >
          <div style={{ width: 56, height: 56, color: "var(--good)" }}>
            <CheckIcon />
          </div>
          <h2>{t("queueClear")}</h2>
          <p className="muted">
            {reviewed > 0 ? t("reviewedSummary", { count: reviewed, xp: earned }) : t("noDue")}
            {dueCount > 0 ? ` ${t("stillInQueue", { count: dueCount })}` : ""}
          </p>
          {dueCount > 0 ? (
            <button
              className="btn ghost"
              onClick={() => {
                setIndex(0);
                router.refresh();
              }}
            >
              {t("keepReviewing")}
            </button>
          ) : view.anticipation.available ? (
            <>
              <button className="btn" onClick={anticipate} disabled={pending}>
                {t("anticipate")}
              </button>
              <p className="small muted">{t("anticipateBody", { count: view.anticipation.batchSize })}</p>
            </>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sec-h" style={{ paddingTop: 4 }}>
        <h1 style={{ fontSize: 28 }}>{t("title")}</h1>
        <span className="chip mono">
          {index + 1}/{view.cards.length} · {t("inQueue", { count: dueCount })}
        </span>
      </div>
      <div className="bar good">
        <i style={{ width: `${(index / view.cards.length) * 100}%` }} />
      </div>
      <div className={`flash ${flipped ? "flip" : ""}`}>
        <div className="inner">
          <div className="face" aria-hidden={flipped}>
            <span className="eyebrow">{sourceLabel(card.source)}</span>
            <div className="en">{card.term}</div>
            <button
              className="speak"
              style={{ alignSelf: "flex-start" }}
              onClick={() => speech.play("item", card.learningItemId)}
              tabIndex={flipped ? -1 : 0}
            >
              <SoundIcon /> {speech.loadingId === card.learningItemId ? t("generating") : t("listen")}
            </button>
            {card.contextText && card.contextText !== card.term ? (
              <div className="ctxline">
                <span>{card.contextText}</span>
              </div>
            ) : null}
            <span className="spacer" />
            <p className="small muted">{t("rememberFirst")}</p>
          </div>
          <div className="face back" aria-hidden={!flipped}>
            <span className="eyebrow">{sourceLabel(card.source)}</span>
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
            <p className="small muted">{t("howMuch")}</p>
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
              {t(`rating.${rating}`)}
              <small>{intervalLabel(card.intervals[rating])}</small>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn wide" onClick={() => setFlipped(true)}>
          {t("showAnswer")}
        </button>
      )}
    </>
  );
}
