"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LevelRatingKind } from "@/modules/catalog";
import { APP_NAME } from "@/shared/app";
import { useState, useTransition } from "react";
import { refreshWorkAction, studyEpisodeAction } from "@/app/actions/catalog";
import type { EpisodeStatus } from "@/modules/catalog";
import type { LevelFit } from "@/shared/levels";
import { LANGUAGE_TAGS, type LanguagePair, type StudyLanguage } from "@/shared/study-languages";
import { BackIcon, CheckIcon, MarkerIcon, PlayIcon, PlusIcon } from "../icons";
import { useShell } from "../shell/app-shell";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { FIT_CLASS } from "./catalog-screen";
import { Poster, type PosterData } from "./poster";
import { routes } from "@/shared/routes";

export type EpisodeRow = {
  id: string;
  episodeNumber: number;
  title: string;
  status: EpisodeStatus;
  cueCount: number;
  subtitleLanguages: StudyLanguage[];
  durationMinutes: number | null;
  progressPercent: number | null;
  failureReason: string | null;
  stillUrl: string | null;
};

export type MediaDetailView = {
  id: string;
  poster: PosterData;
  backdropUrl: string | null;
  overview: string;
  fit: LevelFit;
  levelRange: string;
  levelRatings: { kind: LevelRatingKind; source: string | null; range: string }[];
  accent: string | null;
  uploaderName: string | null;
  canRefresh: boolean;
  seasons: { seasonNumber: number; title: string; episodeCount: number | null }[];
  seasonNumber: number | null;
  pair: LanguagePair;
  episodes: EpisodeRow[];
};

const COMPLETE = 100;

const episodeTag = (isMovie: boolean, episodeNumber: number): string =>
  isMovie ? "▶" : `E${String(episodeNumber).padStart(2, "0")}`;

function StatusChips({ episode }: { episode: EpisodeRow }) {
  const t = useTranslations("media.status");
  if (episode.status === "READY") {
    return (
      <>
        <span className="chip good">{t("ready", { count: episode.cueCount })}</span>
        <span className="chip mono">
          {episode.subtitleLanguages.map((language) => LANGUAGE_TAGS[language]).join(" + ")}
        </span>
      </>
    );
  }
  if (episode.status === "PROCESSING" || episode.status === "UPLOADED") {
    return <span className="chip brand">{t("processing")}</span>;
  }
  if (episode.status === "NEEDS_REVIEW") return <span className="chip warn">{t("needsReview")}</span>;
  if (episode.status === "FAILED") return <span className="chip bad">{t("failed")}</span>;
  return <span className="chip">{t("none")}</span>;
}

export function MediaDetailScreen({ media }: { media: MediaDetailView }) {
  const t = useTranslations("media");
  const fits = useTranslations("fit");
  const router = useRouter();
  const toast = useToast();
  const { openCatalogOptions } = useShell();
  const [pending, startTransition] = useTransition();
  const [pickingSeason, setPickingSeason] = useState(false);
  const seasonNumber = media.seasonNumber;
  const current = media.seasons.find((candidate) => candidate.seasonNumber === seasonNumber);
  const isMovie = media.poster.type === "movie";

  const study = (episode: EpisodeRow) =>
    startTransition(async () => {
      const result = await studyEpisodeAction(episode.id);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast(
        t("nowStudying", {
          title: media.poster.title,
          label: isMovie
            ? t("movie")
            : t("seasonEpisode", { season: seasonNumber ?? 0, episode: episode.episodeNumber }),
        }),
      );
      router.push(isMovie ? routes.trail(media.id) : routes.trail(media.id, seasonNumber));
      router.refresh();
    });

  const refresh = () =>
    startTransition(async () => {
      const result = await refreshWorkAction(media.id);
      toast(result.ok ? t("refreshed") : result.message);
      router.refresh();
    });

  return (
    <>
      <div className="sec-h" style={{ paddingTop: 4, alignItems: "center" }}>
        <Link className="back" href="/catalog">
          <BackIcon /> {t("explore")}
        </Link>
        <button
          className="playbtn"
          onClick={() => openCatalogOptions(media.poster.title, media.id)}
          aria-label={t("options")}
          aria-haspopup="dialog"
        >
          <PlusIcon />
        </button>
      </div>
      {media.backdropUrl ? (
        <div className="dback">
          <Image
            src={media.backdropUrl}
            alt=""
            width={780}
            height={439}
            sizes="(max-width: 480px) 100vw, 480px"
            priority
          />
        </div>
      ) : null}
      <div className={`dhead ${media.backdropUrl ? "over" : ""}`}>
        <Poster media={media.poster} sizes="110px" />
        <div className="col" style={{ gap: 8, minWidth: 0 }}>
          <h1 style={{ fontSize: 24, lineHeight: 1.1 }}>{media.poster.title}</h1>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className={`chip ${FIT_CLASS[media.fit]}`}>{fits(media.fit)}</span>
            <span className="chip mono">{media.levelRange}</span>
            {media.accent ? <span className="chip">{t("accent", { accent: media.accent })}</span> : null}
          </div>
        </div>
      </div>
      {media.overview ? <p className="muted">{media.overview}</p> : null}
      {media.levelRatings.length > 0 ? (
        <p className="small muted">
          {t("levelRatings", { count: media.levelRatings.length })}{" "}
          {media.levelRatings
            .map((rating) => {
              const label =
                rating.kind === "builtin"
                  ? t("levelRatingBuiltin", { app: APP_NAME })
                  : rating.kind === "ai"
                    ? t("levelRatingAi")
                    : rating.source;
              return `${label} ${rating.range}`;
            })
            .join(" · ")}
        </p>
      ) : null}
      <p className="note">
        {media.uploaderName ? t("sharedBy", { name: media.uploaderName }) : t("shared")}
        {media.canRefresh ? (
          <>
            {" "}
            <button className="link small" onClick={refresh} disabled={pending}>
              {t("refreshTmdb")}
            </button>
          </>
        ) : null}
      </p>
      {!isMovie && media.seasons.length > 0 ? (
        <button className="seasonpick" onClick={() => setPickingSeason(true)} aria-label={t("switchSeason")}>
          <span>
            <b>{current?.title ?? t("season", { number: seasonNumber ?? 0 })}</b>
            {current?.episodeCount ? (
              <span className="muted"> · {t("episodes", { count: current.episodeCount })}</span>
            ) : null}
          </span>
          <span className="link small">
            {media.seasons.length > 1
              ? t("switchSeasons", { count: media.seasons.length })
              : t("singleSeason")}
          </span>
        </button>
      ) : null}
      {pickingSeason ? (
        <Sheet label={t("seasons")} onClose={() => setPickingSeason(false)}>
          <h2 style={{ fontSize: 22 }}>{t("seasons")}</h2>
          <div className="col">
            {media.seasons.map((option) => (
              <button
                key={option.seasonNumber}
                className={`result ${option.seasonNumber === seasonNumber ? "on" : ""}`}
                onClick={() => {
                  setPickingSeason(false);
                  router.push(routes.work(media.id, option.seasonNumber));
                }}
              >
                <span className="lvlchip" style={{ textAlign: "center" }}>
                  T{option.seasonNumber}
                </span>
                <span className="col" style={{ gap: 2, minWidth: 0 }}>
                  <b>{option.title}</b>
                  <span className="small muted">
                    {option.episodeCount
                      ? t("episodes", { count: option.episodeCount })
                      : t("episodesToLoad")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      {media.episodes.length > 0 ? (
        <section className="card" style={{ padding: "4px 16px" }}>
          {media.episodes.map((episode) => {
            const ready = episode.status === "READY" && episode.subtitleLanguages.includes(media.pair.target);
            return (
              <div className={`ep ${episode.stillUrl ? "photo" : ""}`} key={episode.id}>
                {episode.stillUrl ? (
                  <span className="still">
                    <Image src={episode.stillUrl} alt="" width={300} height={169} sizes="76px" />
                    <span className="num">{episodeTag(isMovie, episode.episodeNumber)}</span>
                  </span>
                ) : (
                  <span className="num">{episodeTag(isMovie, episode.episodeNumber)}</span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="t">{episode.title}</div>
                  <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <StatusChips episode={episode} />
                    {episode.durationMinutes ? (
                      <span className="small muted mono">{episode.durationMinutes} min</span>
                    ) : null}
                  </div>
                  {episode.progressPercent ? (
                    <div className={`bar ${episode.progressPercent === COMPLETE ? "good" : ""}`}>
                      <i style={{ width: `${episode.progressPercent}%` }} />
                    </div>
                  ) : null}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {ready ? (
                    <Link
                      className="playbtn"
                      style={{
                        background: "var(--cue)",
                        color: "var(--cue-ink)",
                        boxShadow: "0 3px 0 var(--cue-deep)",
                      }}
                      href={routes.read(episode.id)}
                      aria-label={t("readAndMarkTitle", { title: episode.title })}
                    >
                      <MarkerIcon />
                    </Link>
                  ) : (
                    <button className="playbtn" disabled aria-label={t("readAndMark")}>
                      <MarkerIcon />
                    </button>
                  )}
                  <button
                    className="playbtn"
                    disabled={!ready || pending}
                    onClick={() => study(episode)}
                    aria-label={t("studyTitle", { title: episode.title })}
                  >
                    {episode.progressPercent === COMPLETE ? <CheckIcon /> : <PlayIcon />}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <p className="muted">{t("noEpisodes")}</p>
      )}
      <button
        className="fab"
        onClick={() => openCatalogOptions(media.poster.title, media.id)}
        aria-haspopup="dialog"
      >
        <PlusIcon /> {t("options")}
      </button>
    </>
  );
}
