"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { LevelFit } from "@/shared/levels";
import { LANGUAGE_TAGS, type StudyLanguage } from "@/shared/study-languages";
import { PlusIcon, SearchIcon } from "../icons";
import { useShell } from "../shell/app-shell";
import { Poster, type PosterData } from "./poster";
import { SuggestionsSection, type SuggestionsView } from "./suggestions-section";

export type CatalogTile = PosterData & {
  id: string;
  fit: LevelFit;
  levelRange: string;
  originalLanguage: StudyLanguage;
};
export type PersonalTile = { name: string; subtitle: string; progressPercent: number; poster: PosterData };
export type InProgressTile = {
  episodeId: string;
  mediaId: string;
  seasonNumber: number;
  poster: PosterData;
  label: string;
  episodeTitle: string;
  progressPercent: number;
};

type Filter = "all" | "fit" | "series" | "movie";
const FILTERS: Filter[] = ["all", "fit", "series", "movie"];

export const FIT_CLASS: Record<LevelFit, string> = { fit: "good", challenging: "warn", easy: "" };

export function CatalogScreen({
  tiles,
  inProgress,
  personal,
  suggestions,
}: {
  tiles: CatalogTile[];
  inProgress: InProgressTile[];
  personal: PersonalTile;
  suggestions: SuggestionsView;
}) {
  const t = useTranslations("catalog");
  const fits = useTranslations("fit");
  const browse = useTranslations("tmdbBrowse");
  const { openCatalogOptions } = useShell();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const needle = query.trim().toLowerCase();
  const visible = tiles.filter((tile) => {
    if (needle && !tile.title.toLowerCase().includes(needle)) return false;
    if (filter === "fit") return tile.fit === "fit";
    if (filter === "series" || filter === "movie") return tile.type === filter;
    return true;
  });

  return (
    <>
      <div className="sec-h" style={{ paddingTop: 4, alignItems: "center" }}>
        <h1 style={{ fontSize: 28 }}>{t("title")}</h1>
        <button
          className="playbtn"
          onClick={() => openCatalogOptions(t("catalog"))}
          aria-label={t("options")}
          aria-haspopup="dialog"
        >
          <PlusIcon />
        </button>
      </div>
      <label className="search">
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          autoComplete="off"
          aria-label={t("search")}
        />
      </label>
      <div className="chips">
        {FILTERS.map((option) => (
          <button
            key={option}
            className={`fchip ${filter === option ? "on" : ""}`}
            onClick={() => setFilter(option)}
          >
            {t(`filters.${option}`)}
          </button>
        ))}
      </div>
      {!needle ? (
        <section className="col" style={{ gap: 10 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 18 }}>{t("inProgress")}</h2>
          </div>
          <div className="hscroll">
            <Link className="cont card" style={{ padding: 10 }} href="/trail/personal">
              <Poster media={personal.poster} sizes="64px" />
              <div className="col" style={{ gap: 4, minWidth: 0 }}>
                <b className="small">{personal.name}</b>
                <span className="small muted">{personal.subtitle}</span>
                <div className="bar" style={{ height: 6 }}>
                  <i style={{ width: `${personal.progressPercent}%` }} />
                </div>
              </div>
            </Link>
            {inProgress.map((entry) => (
              <Link
                key={entry.episodeId}
                className="cont card"
                style={{ padding: 10 }}
                href={
                  entry.poster.type === "movie"
                    ? `/trail/${entry.mediaId}`
                    : `/trail/${entry.mediaId}?season=${entry.seasonNumber}`
                }
              >
                <Poster media={entry.poster} sizes="64px" />
                <div className="col" style={{ gap: 4, minWidth: 0 }}>
                  <b className="small">{entry.poster.title}</b>
                  <span className="small muted">
                    {entry.label} · {entry.episodeTitle}
                  </span>
                  <div className="bar" style={{ height: 6 }}>
                    <i style={{ width: `${entry.progressPercent}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {!needle && filter === "all" ? <SuggestionsSection view={suggestions} /> : null}
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 18 }}>{t("catalog")}</h2>
          <span className="small muted">{t("titles", { count: visible.length })}</span>
        </div>
        <Link
          className="link small"
          href={needle ? `/catalog/tmdb?q=${encodeURIComponent(query.trim())}` : "/catalog/tmdb"}
        >
          {browse("seeAll")}
        </Link>
        {visible.length > 0 ? (
          <div className="pgrid">
            {visible.map((tile) => (
              <Link key={tile.id} className="ptile" href={`/catalog/${tile.id}`} aria-label={tile.title}>
                <Poster media={tile} />
                <div className="meta">
                  <span className={`chip ${FIT_CLASS[tile.fit]}`}>{fits(tile.fit)}</span>
                  <span className="chip mono">
                    {LANGUAGE_TAGS[tile.originalLanguage]} · {tile.levelRange}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">{needle ? t("nothingFound", { query }) : t("empty")}</p>
        )}
      </section>
      <button className="fab" onClick={() => openCatalogOptions(t("catalog"))} aria-haspopup="dialog">
        <PlusIcon /> {t("options")}
      </button>
    </>
  );
}
