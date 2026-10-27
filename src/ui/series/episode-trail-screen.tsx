"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { EpisodeNode } from "@/modules/personal-series";
import { BackIcon, CheckIcon, EarIcon, LockIcon, PenIcon, QuoteIcon } from "../icons";
import { routes } from "@/shared/routes";

export type EpisodeTrailView = {
  id: string;
  title: string;
  number: number;
  seasonNumber: number;
  seasonLevel: string;
  seriesName: string | null;
  cardCount: number;
  progress: number;
  nodes: EpisodeNode[];
  sources: { sessionId: string; themeId: string; themeTitle: string; closedAt: string | null }[];
};

const NODE_ICONS = [QuoteIcon, EarIcon, PenIcon];

export function EpisodeTrailScreen({ view }: { view: EpisodeTrailView }) {
  const t = useTranslations("series");
  const themes = useTranslations("talk");
  const format = useFormatter();
  const themeTitle = (themeId: string, fallback: string) =>
    themes.has(`themes.${themeId}.title`) ? themes(`themes.${themeId}.title`) : fallback;
  return (
    <>
      <Link className="back" href="/series">
        <BackIcon />
        {view.seriesName ?? t("defaultName")}
      </Link>
      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">
          {t("episodeEyebrow", { season: view.seasonNumber, number: view.number, level: view.seasonLevel })}
        </span>
        <h1 style={{ fontSize: 26 }}>{view.title}</h1>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="chip brand">{t("cards", { count: view.cardCount })}</span>
          <span className="chip">{t("createdByAi")}</span>
          <span className="chip good">{t("progress", { percent: view.progress })}</span>
        </div>
      </div>
      <section className="card col" style={{ gap: 8 }}>
        <span className="eyebrow">{t("sourcesTitle")}</span>
        {view.sources.length === 0 ? (
          <span className="small muted">{t("noSources")}</span>
        ) : (
          view.sources.map((source) => (
            <div key={source.sessionId} className="row" style={{ justifyContent: "space-between" }}>
              <span className="small">
                {themeTitle(source.themeId, source.themeTitle)}
                {source.closedAt
                  ? ` · ${format.dateTime(new Date(source.closedAt), { day: "2-digit", month: "2-digit" })}`
                  : ""}
              </span>
              <Link className="link small" href={routes.conversation(source.sessionId)}>
                {t("reread")}
              </Link>
            </div>
          ))
        )}
      </section>
      {view.nodes.length === 0 ? (
        <p className="small muted">{t("emptyTrail")}</p>
      ) : (
        <div className="trail">
          {view.nodes.map((node) => {
            const NodeIcon = NODE_ICONS[node.index % NODE_ICONS.length] ?? QuoteIcon;
            const side = node.index % 2 === 0 ? "l" : "r";
            const state = node.state === "current" ? "cur" : node.state;
            const icon =
              node.state === "done" ? <CheckIcon /> : node.state === "locked" ? <LockIcon /> : <NodeIcon />;
            return (
              <div key={node.index} className={`tnode ${side} ${state}`}>
                {node.state === "current" ? <span className="startpop">{t("start")}</span> : null}
                {node.state === "locked" ? (
                  <span className="dot" aria-disabled="true">
                    {icon}
                  </span>
                ) : (
                  <Link
                    className="dot"
                    href={routes.personalLesson(view.id, node.index)}
                    aria-label={t("nodeLabel", { number: node.index + 1 })}
                  >
                    {icon}
                  </Link>
                )}
                <div className="lbl">
                  <div className="tc">{t("nodeLabel", { number: node.index + 1 })}</div>
                  <div className="nm">{node.title}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
