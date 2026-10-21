"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { openTmdbWorkAction, rateWorkLevelAction } from "@/app/actions/catalog";
import type { DiscoverSort, MediaType } from "@/modules/catalog";
import type { LevelFit } from "@/shared/levels";
import { STUDY_LANGUAGES, type StudyLanguage } from "@/shared/study-languages";
import { BackIcon, SearchIcon } from "../icons";
import { FIT_CLASS } from "./catalog-screen";
import { Poster, type PosterData } from "./poster";

export type TmdbBrowseFilters = {
  query: string;
  type: MediaType;
  language: StudyLanguage | "all";
  sort: DiscoverSort;
  page: number;
};

export type TmdbWorkView = {
  externalId: string;
  catalogMediaId: string | null;
  poster: PosterData;
  voteAverage: number | null;
  levelRange: string | null;
  fit: LevelFit | null;
  ratings: number;
  hasAi: boolean;
  aiReason: string | null;
};

const SORTS: DiscoverSort[] = ["popular", "votes", "rating"];
const TYPES: MediaType[] = ["series", "movie"];
const LANGUAGES: (StudyLanguage | "all")[] = [...STUDY_LANGUAGES, "all"];

function hrefFor(filters: TmdbBrowseFilters, change: Partial<TmdbBrowseFilters>): string {
  const next = { ...filters, page: 1, ...change };
  const params = new URLSearchParams({
    type: next.type,
    lang: next.language,
    sort: next.sort,
    page: String(next.page),
  });
  if (next.query) params.set("q", next.query);
  return `/catalog/tmdb?${params.toString()}`;
}

function WorkTile({ work }: { work: TmdbWorkView }) {
  const t = useTranslations("tmdbBrowse");
  const fits = useTranslations("fit");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [rated, setRated] = useState<{ range: string; reason: string; ratings: number } | null>(null);
  const levelRange = rated?.range ?? work.levelRange;
  const reason = rated?.reason ?? work.aiReason;
  const ratings = rated?.ratings ?? work.ratings;
  const type = work.poster.type;

  const open = () =>
    startTransition(async () => {
      setError("");
      if (work.catalogMediaId) {
        router.push(`/catalog/${work.catalogMediaId}`);
        return;
      }
      const result = await openTmdbWorkAction({ type, externalId: work.externalId });
      if (result.ok) router.push(`/catalog/${result.data.mediaId}`);
      else setError(result.message);
    });

  const rate = () =>
    startTransition(async () => {
      setError("");
      const result = await rateWorkLevelAction({ type, externalId: work.externalId });
      if (result.ok) {
        setRated(result.data);
        router.refresh();
      } else setError(result.message);
    });

  return (
    <article className="col" style={{ gap: 6 }} aria-label={work.poster.title}>
      <button
        className="ptile"
        style={{ padding: 0, border: 0, background: "none", textAlign: "left" }}
        onClick={open}
        disabled={pending}
      >
        <Poster media={levelRange ? { ...work.poster, levelRange } : work.poster} />
      </button>
      <b className="small">{work.poster.title}</b>
      <span className="small muted">
        {[
          work.poster.year,
          work.voteAverage
            ? t("vote", { value: format.number(work.voteAverage, { maximumFractionDigits: 1 }) })
            : null,
        ]
          .filter((part) => part !== null)
          .join(" · ")}
      </span>
      <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
        {levelRange ? (
          <>
            {work.fit ? <span className={`chip ${FIT_CLASS[work.fit]}`}>{fits(work.fit)}</span> : null}
            <span className="chip mono">{levelRange}</span>
          </>
        ) : (
          <span className="chip">{t("noLevel")}</span>
        )}
      </div>
      {ratings > 0 ? (
        <span className="small muted">
          {t("ratings", { count: ratings })}
          {work.hasAi || rated ? ` · ${t("ai")}` : ""}
        </span>
      ) : null}
      {reason ? (
        <p className="small muted" style={{ margin: 0 }}>
          {reason}
        </p>
      ) : null}
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="btn sm" onClick={open} disabled={pending}>
          {work.catalogMediaId ? t("openInCatalog") : t("open")}
        </button>
        <button type="button" className="btn ghost sm" onClick={rate} disabled={pending}>
          {pending ? t("rating") : work.hasAi || rated ? t("rateAgain") : t("rate")}
        </button>
      </div>
      {error ? <p className="formerr small">{error}</p> : null}
    </article>
  );
}

export function TmdbBrowseScreen({
  filters,
  works,
  page,
  totalPages,
  searching,
  failed,
}: {
  filters: TmdbBrowseFilters;
  works: TmdbWorkView[];
  page: number;
  totalPages: number;
  searching: boolean;
  failed: boolean;
}) {
  const t = useTranslations("tmdbBrowse");
  const languages = useTranslations("languages");
  const [query, setQuery] = useState(filters.query);
  const router = useRouter();

  return (
    <>
      <div className="row" style={{ gap: 8, alignItems: "center", paddingTop: 4 }}>
        <Link className="iconbtn" href="/catalog" aria-label={t("back")}>
          <BackIcon />
        </Link>
        <h1 style={{ fontSize: 24, flex: 1 }}>{t("title")}</h1>
        <a className="btn ghost sm" href="/api/level-ratings/export" download>
          {t("export")}
        </a>
      </div>
      <p className="small muted">{t("intro")}</p>
      <form
        className="search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(hrefFor(filters, { query: query.trim() }));
        }}
      >
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          autoComplete="off"
          enterKeyHint="search"
        />
      </form>
      {searching ? (
        <p className="small muted">
          {t("searchingFor", { query: filters.query })}{" "}
          <Link className="link small" href={hrefFor(filters, { query: "" })}>
            {t("clearSearch")}
          </Link>
        </p>
      ) : (
        <>
          <div className="chips" aria-label={t("typeLabel")}>
            {TYPES.map((type) => (
              <Link
                key={type}
                className={`fchip ${filters.type === type ? "on" : ""}`}
                href={hrefFor(filters, { type })}
              >
                {t(`types.${type}`)}
              </Link>
            ))}
          </div>
          <div className="chips" aria-label={t("languageLabel")}>
            {LANGUAGES.map((language) => (
              <Link
                key={language}
                className={`fchip ${filters.language === language ? "on" : ""}`}
                href={hrefFor(filters, { language })}
              >
                {language === "all" ? t("allLanguages") : languages(language)}
              </Link>
            ))}
          </div>
          <div className="chips" aria-label={t("sortLabel")}>
            {SORTS.map((sort) => (
              <Link
                key={sort}
                className={`fchip ${filters.sort === sort ? "on" : ""}`}
                href={hrefFor(filters, { sort })}
              >
                {t(`sorts.${sort}`)}
              </Link>
            ))}
          </div>
        </>
      )}
      {failed ? <p className="formerr">{t("failed")}</p> : null}
      {!failed && works.length === 0 ? <p className="muted">{t("empty")}</p> : null}
      {works.length > 0 ? (
        <div className="pgrid">
          {works.map((work) => (
            <WorkTile key={work.externalId} work={work} />
          ))}
        </div>
      ) : null}
      {!searching && totalPages > 1 ? (
        <nav
          className="row"
          style={{ gap: 8, justifyContent: "space-between", alignItems: "center" }}
          aria-label={t("pages")}
        >
          {page > 1 ? (
            <Link className="btn ghost sm" href={hrefFor(filters, { page: page - 1 })}>
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="small muted">{t("pageOf", { page, total: totalPages })}</span>
          {page < totalPages ? (
            <Link className="btn ghost sm" href={hrefFor(filters, { page: page + 1 })}>
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
      <p className="small muted">{t("attribution")}</p>
    </>
  );
}
