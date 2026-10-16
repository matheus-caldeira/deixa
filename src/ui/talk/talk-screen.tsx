"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { startConversationAction } from "@/app/actions/tutor";
import { CUSTOM_THEME_ID, MAX_TOPIC_LENGTH } from "@/modules/conversations";
import { BackIcon, FilmIcon, Icon, SparkIcon, type IconName } from "../icons";
import { useToast } from "../shell/toast";

export type ThemeView = { id: string; icon: IconName };
export type RecentConversation = {
  id: string;
  themeId: string;
  title: string;
  turnCount: number;
  closed: boolean;
  reviewStatus: "none" | "queued" | "running" | "ready" | "failed";
  score: number | null;
};

export type SeriesTeaser = { name: string | null; episodes: number; cards: number };

export type LearnerNotes = { improvements: string[]; strengths: string[]; mistakes: string[] };

function LearnerCard({ learner }: { learner: LearnerNotes }) {
  const t = useTranslations("talk");
  const groups = [
    { key: "improvements", items: learner.improvements },
    { key: "strengths", items: learner.strengths },
    { key: "mistakes", items: learner.mistakes },
  ].filter((group) => group.items.length > 0);
  if (groups.length === 0) {
    return (
      <div className="hint">
        <span>{t("learnerEmpty")}</span>
      </div>
    );
  }
  return (
    <section className="card col" style={{ gap: 8 }}>
      <h2 style={{ fontSize: 18 }}>{t("learnerTitle")}</h2>
      <p className="small muted">{t("learnerBody")}</p>
      {groups.map((group) => (
        <div key={group.key} className="col" style={{ gap: 2 }}>
          <span className="eyebrow">{t(`learner.${group.key}`)}</span>
          <span className="small">{group.items.join(" · ")}</span>
        </div>
      ))}
    </section>
  );
}

export function TalkScreen(props: {
  themes: ThemeView[];
  recent: RecentConversation[];
  simulated: boolean;
  learner: LearnerNotes;
  series: SeriesTeaser;
}) {
  const t = useTranslations("talk");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");
  const themeTitle = (themeId: string, fallback: string) =>
    t.has(`themes.${themeId}.title`) ? t(`themes.${themeId}.title`) : fallback;

  const start = (themeId: string, customTopic: string | null) =>
    startTransition(async () => {
      const result = await startConversationAction({ themeId, customTopic }).catch(() => null);
      if (result && !result.ok) toast(result.message);
    });

  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>{t("title")}</h1>
      <p className="muted">{t("intro")}</p>
      {props.simulated ? (
        <div className="hint">
          <span>
            <b>{t("simulated")}</b> {t("simulatedBody")}
          </span>
        </div>
      ) : null}
      <Link className="pcard" href="/series">
        <span className="avatar pposter" style={{ fontSize: 13 }}>
          <FilmIcon width={24} height={24} />
        </span>
        <span className="col" style={{ gap: 2, minWidth: 0 }}>
          <b>{props.series.name ?? t("seriesDefaultName")}</b>
          <span className="small muted">
            {props.series.episodes === 0
              ? t("seriesEmpty")
              : t("seriesSummary", { episodes: props.series.episodes, cards: props.series.cards })}
          </span>
        </span>
        <span style={{ color: "var(--muted)", width: 20, transform: "rotate(180deg)" }}>
          <BackIcon />
        </span>
      </Link>
      <LearnerCard learner={props.learner} />
      <section className="card" style={{ padding: "4px 16px" }}>
        {props.themes.map((theme) => (
          <div className="ep" style={{ gridTemplateColumns: "1fr" }} key={theme.id}>
            <button className="scen" onClick={() => start(theme.id, null)} disabled={pending}>
              <span className="ic">
                <Icon name={theme.icon} />
              </span>
              <span className="col" style={{ gap: 3, minWidth: 0 }}>
                <b>{t(`themes.${theme.id}.title`)}</b>
                <span className="small muted">{t(`themes.${theme.id}.detail`)}</span>
              </span>
              <span style={{ color: "var(--muted)", width: 20, transform: "rotate(180deg)" }}>
                <BackIcon />
              </span>
            </button>
          </div>
        ))}
      </section>
      <form
        className="card col"
        style={{ gap: 10 }}
        onSubmit={(event) => {
          event.preventDefault();
          start(CUSTOM_THEME_ID, topic);
        }}
      >
        <div className="row">
          <SparkIcon className="inline-icon" style={{ color: "var(--brand)" }} />
          <b>{t("otherTopic")}</b>
        </div>
        <div className="field">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            maxLength={MAX_TOPIC_LENGTH}
            placeholder={t("topicPlaceholder")}
            aria-label={t("topicLabel")}
          />
        </div>
        <button className="btn" type="submit" disabled={pending || topic.trim().length < 2}>
          {t("talkAbout")}
        </button>
      </form>
      {props.recent.length > 0 ? (
        <section className="col" style={{ gap: 10 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 18 }}>{t("recent")}</h2>
          </div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {props.recent.map((conversation) => (
              <Link
                className="ep"
                style={{ gridTemplateColumns: "1fr auto" }}
                key={conversation.id}
                href={`/tutor/${conversation.id}`}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="t">{themeTitle(conversation.themeId, conversation.title)}</div>
                  <span className="small muted">{t("messages", { count: conversation.turnCount })}</span>
                </div>
                {conversation.reviewStatus === "ready" ? (
                  <span className="chip good">{t("reviewed", { score: conversation.score ?? 0 })}</span>
                ) : conversation.reviewStatus === "queued" || conversation.reviewStatus === "running" ? (
                  <span className="chip warn">{t("reviewing")}</span>
                ) : conversation.closed ? (
                  <span className="chip">{t("closed")}</span>
                ) : (
                  <span className="chip brand">{t("open")}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
