"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { confirmConversationCardsAction } from "@/app/actions/tutor";
import { DIFFICULTY_KINDS, type ConversationReview, type Difficulty } from "@/modules/conversations";
import { CheckIcon, FilmIcon, SparkIcon, XIcon } from "../icons";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";

export type ConversationReviewView = {
  sessionId: string;
  themeId: string;
  title: string;
  review: ConversationReview;
  cardsConfirmed: boolean;
  turns: { id: string; text: string }[];
};

const RING_RADIUS = 30;

function ScoreRing({ score }: { score: number }) {
  const length = 2 * Math.PI * RING_RADIUS;
  return (
    <div className="ring">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle cx="36" cy="36" r={RING_RADIUS} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx="36"
          cy="36"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--good)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(length * score) / 100} ${length}`}
        />
      </svg>
      <b>{score}</b>
    </div>
  );
}

function highlighted(sentence: string, term: string): React.ReactNode {
  const at = sentence.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return sentence;
  return (
    <>
      {sentence.slice(0, at)}
      <mark>{sentence.slice(at, at + term.length)}</mark>
      {sentence.slice(at + term.length)}
    </>
  );
}

function DifficultyCard(props: {
  difficulty: Difficulty;
  sentence: string | null;
  selected: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("conversationReview");
  const { difficulty } = props;
  return (
    <div className={`gcard ${props.selected ? "" : "off"}`}>
      <div className="col" style={{ gap: 4, minWidth: 0 }}>
        <span className="term">{difficulty.target}</span>
        <span className="small">{difficulty.translation}</span>
      </div>
      <button
        className={`tick ${props.selected ? "on" : ""}`}
        onClick={props.onToggle}
        disabled={props.locked}
        aria-pressed={props.selected}
        aria-label={t("toggle", { term: difficulty.target })}
      >
        <CheckIcon />
      </button>
      {difficulty.kind === "tutor" ? (
        props.sentence ? (
          <div className="ctx">
            <span className="small muted">{t("tutorSaid")}</span>
            <span>{highlighted(props.sentence, difficulty.target)}</span>
          </div>
        ) : null
      ) : difficulty.said ? (
        <div className="ctx">
          <span className="small muted">{t("youSaid")}</span>
          <span>
            <s>{difficulty.said}</s>
          </span>
          <span>
            <ins>{difficulty.target}</ins>
          </span>
        </div>
      ) : null}
      <span className="why">{difficulty.why}</span>
    </div>
  );
}

export function ConversationReviewScreen({ view }: { view: ConversationReviewView }) {
  const t = useTranslations("conversationReview");
  const themes = useTranslations("talk");
  const router = useRouter();
  const toast = useToast();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();
  const { review } = view;
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(view.cardsConfirmed ? [] : review.difficulties.map((difficulty) => difficulty.id)),
  );
  const locked = view.cardsConfirmed;
  const title = themes.has(`themes.${view.themeId}.title`)
    ? themes(`themes.${view.themeId}.title`)
    : view.title;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const destinations = new Map<string, { title: string; isNew: boolean; terms: string[] }>();
  for (const difficulty of review.difficulties) {
    if (!selected.has(difficulty.id)) continue;
    const key = difficulty.episodeId ?? `new:${difficulty.theme.toLowerCase()}`;
    const entry = destinations.get(key) ?? {
      title: difficulty.episodeTitle,
      isNew: difficulty.episodeId === null,
      terms: [],
    };
    entry.terms.push(difficulty.target);
    destinations.set(key, entry);
  }

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmConversationCardsAction({
        sessionId: view.sessionId,
        difficultyIds: [...selected],
      }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      toast(t("confirmedToast", { cards: result.data.cards, episodes: result.data.newEpisodes }));
      router.push(result.data.cards > 0 ? "/series" : `/tutor/${view.sessionId}`);
    });

  return (
    <div className="lesson">
      <div className="lhead">
        <Link className="iconbtn" href={`/tutor/${view.sessionId}`} aria-label={t("back")}>
          <XIcon />
        </Link>
        <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
          <span className="eyebrow">{t("eyebrow")}</span>
          <h2 style={{ fontSize: 19 }}>{title}</h2>
        </div>
      </div>
      <div className="lbody">
        <div className="card goalrow">
          <ScoreRing score={review.score} />
          <p className="small">{review.summary}</p>
        </div>
        {review.strengths.length > 0 ? (
          <div className="col">
            <span className="eyebrow">{t("strengths")}</span>
            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {review.strengths.map((item) => (
                <span key={item} className="chip good" style={{ whiteSpace: "normal", borderRadius: 12 }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {review.improvements.length > 0 ? (
          <div className="col">
            <span className="eyebrow">{t("improvements")}</span>
            {review.improvements.map((item) => (
              <span key={item} className="small">
                · {item}
              </span>
            ))}
          </div>
        ) : null}
        <div className="sec-h">
          <h2>{t("difficulties")}</h2>
          {locked || review.difficulties.length === 0 ? null : (
            <button
              className="link"
              onClick={() =>
                setSelected(
                  selected.size === review.difficulties.length
                    ? new Set()
                    : new Set(review.difficulties.map((difficulty) => difficulty.id)),
                )
              }
            >
              {selected.size === review.difficulties.length ? t("unselectAll") : t("selectAll")}
            </button>
          )}
        </div>
        <p className="small muted" style={{ marginTop: -10 }}>
          {review.difficulties.length === 0
            ? t("noDifficulties")
            : locked
              ? t("lockedBody")
              : t("difficultiesBody")}
        </p>
        {DIFFICULTY_KINDS.map((kind) => {
          const items = review.difficulties.filter((difficulty) => difficulty.kind === kind);
          if (items.length === 0) return null;
          return (
            <section key={kind} className="col" style={{ gap: 10 }}>
              <div className="row" style={{ gap: 8 }}>
                <h3 style={{ fontSize: 17 }}>{t(`kinds.${kind}`)}</h3>
                <span className="small muted mono">{items.length}</span>
              </div>
              {items.map((difficulty) => (
                <DifficultyCard
                  key={difficulty.id}
                  difficulty={difficulty}
                  sentence={
                    difficulty.turnIndex === null ? null : (view.turns[difficulty.turnIndex]?.text ?? null)
                  }
                  selected={selected.has(difficulty.id)}
                  locked={locked}
                  onToggle={() => toggle(difficulty.id)}
                />
              ))}
            </section>
          );
        })}
        {locked ? null : (
          <>
            <div className="sec-h">
              <h2>{t("inSeries")}</h2>
            </div>
            <p className="small muted" style={{ marginTop: -10 }}>
              {t("inSeriesBody")}
            </p>
            <div className="card col" style={{ gap: 12 }}>
              {destinations.size === 0 ? (
                <span className="small muted">{t("noneSelected")}</span>
              ) : (
                [...destinations.entries()].map(([key, entry]) => (
                  <div className="dest" key={key}>
                    <span className={`ic ${entry.isNew ? "new" : ""}`}>
                      {entry.isNew ? <SparkIcon /> : <FilmIcon />}
                    </span>
                    <div className="col" style={{ gap: 2, minWidth: 0 }}>
                      <b>{entry.title}</b>
                      <span className="small muted">{entry.terms.join(", ")}</span>
                    </div>
                    <span className={`chip ${entry.isNew ? "warn" : "brand"}`}>
                      {entry.isNew ? t("newEpisode") : t("plusCards", { count: entry.terms.length })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
      <div className="lfoot">
        {locked ? (
          <Link className="btn block" href="/series">
            {t("openSeries")}
          </Link>
        ) : (
          <button className="btn block" onClick={confirm} disabled={pending}>
            {selected.size === 0 ? t("confirmNone") : t("confirm", { count: selected.size })}
          </button>
        )}
        <Link className="btn ghost block" style={{ marginTop: 10 }} href={`/tutor/${view.sessionId}`}>
          {t("reread")}
        </Link>
      </div>
    </div>
  );
}
