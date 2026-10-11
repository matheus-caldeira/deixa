"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshWorkAction, studyEpisodeAction } from "@/app/actions/catalog";
import type { EpisodeStatus } from "@/modules/catalog";
import type { LevelFit } from "@/shared/levels";
import { BackIcon, CheckIcon, MarkerIcon, PlayIcon, UploadIcon } from "../icons";
import { useShell } from "../shell/app-shell";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { FIT_CHIP } from "./catalog-screen";
import { Poster, type PosterData } from "./poster";

export type EpisodeRow = {
  id: string;
  episodeNumber: number;
  title: string;
  status: EpisodeStatus;
  cueCount: number;
  hasPortuguese: boolean;
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
  accent: string | null;
  uploaderName: string | null;
  canRefresh: boolean;
  seasons: { seasonNumber: number; title: string; episodeCount: number | null }[];
  seasonNumber: number | null;
  episodes: EpisodeRow[];
};

const COMPLETE = 100;

const episodeTag = (isMovie: boolean, episodeNumber: number): string =>
  isMovie ? "▶" : `E${String(episodeNumber).padStart(2, "0")}`;

function StatusChips({ episode }: { episode: EpisodeRow }) {
  if (episode.status === "READY") {
    return (
      <>
        <span className="chip good">Pronto · {episode.cueCount} falas</span>
        <span className="chip mono">{episode.hasPortuguese ? "EN + PT" : "só EN"}</span>
      </>
    );
  }
  if (episode.status === "PROCESSING" || episode.status === "UPLOADED") {
    return <span className="chip brand">Processando</span>;
  }
  if (episode.status === "NEEDS_REVIEW") return <span className="chip warn">Em revisão</span>;
  if (episode.status === "FAILED") return <span className="chip bad">Falhou · envie de novo</span>;
  return <span className="chip">Sem legenda</span>;
}

export function MediaDetailScreen({ media }: { media: MediaDetailView }) {
  const router = useRouter();
  const toast = useToast();
  const { openUpload } = useShell();
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
        `Agora estudando: ${media.poster.title} · ${isMovie ? "Filme" : `T${seasonNumber} · E${episode.episodeNumber}`}`,
      );
      router.push("/");
      router.refresh();
    });

  const refresh = () =>
    startTransition(async () => {
      const result = await refreshWorkAction(media.id);
      toast(result.ok ? "Dados da obra atualizados." : result.message);
      router.refresh();
    });

  return (
    <>
      <Link className="back" href="/catalog">
        <BackIcon /> Explorar
      </Link>
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
            <span className={`chip ${FIT_CHIP[media.fit].className}`}>{FIT_CHIP[media.fit].label}</span>
            <span className="chip mono">{media.levelRange}</span>
            {media.accent ? <span className="chip">Sotaque: {media.accent}</span> : null}
          </div>
        </div>
      </div>
      {media.overview ? <p className="muted">{media.overview}</p> : null}
      <p className="note">
        {media.uploaderName ? `Cadastrada por ${media.uploaderName} e compartilhada` : "Compartilhada"} no
        catálogo. Seu progresso neste título é só seu.
        {media.canRefresh ? (
          <>
            {" "}
            <button className="link small" onClick={refresh} disabled={pending}>
              Atualizar dados do TMDB
            </button>
          </>
        ) : null}
      </p>
      {!isMovie && media.seasons.length > 0 ? (
        <button
          className="seasonpick"
          onClick={() => setPickingSeason(true)}
          aria-label="Trocar de temporada"
        >
          <span>
            <b>{current?.title ?? `Temporada ${seasonNumber}`}</b>
            {current?.episodeCount ? (
              <span className="muted"> · {current.episodeCount} episódios</span>
            ) : null}
          </span>
          <span className="link small">
            {media.seasons.length > 1 ? `Trocar · ${media.seasons.length} temporadas` : "Temporada única"}
          </span>
        </button>
      ) : null}
      {pickingSeason ? (
        <Sheet label="Temporadas" onClose={() => setPickingSeason(false)}>
          <h2 style={{ fontSize: 22 }}>Temporadas</h2>
          <div className="col">
            {media.seasons.map((option) => (
              <button
                key={option.seasonNumber}
                className={`result ${option.seasonNumber === seasonNumber ? "on" : ""}`}
                onClick={() => {
                  setPickingSeason(false);
                  router.push(`/catalog/${media.id}?season=${option.seasonNumber}`);
                }}
              >
                <span className="lvlchip" style={{ textAlign: "center" }}>
                  T{option.seasonNumber}
                </span>
                <span className="col" style={{ gap: 2, minWidth: 0 }}>
                  <b>{option.title}</b>
                  <span className="small muted">
                    {option.episodeCount ? `${option.episodeCount} episódios` : "episódios a carregar"}
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
            const ready = episode.status === "READY";
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
                      href={`/read/${episode.id}`}
                      aria-label={`Ler e marcar a legenda: ${episode.title}`}
                    >
                      <MarkerIcon />
                    </Link>
                  ) : (
                    <button className="playbtn" disabled aria-label="Ler e marcar a legenda">
                      <MarkerIcon />
                    </button>
                  )}
                  <button
                    className="playbtn"
                    disabled={!ready || pending}
                    onClick={() => study(episode)}
                    aria-label={`Estudar: ${episode.title}`}
                  >
                    {episode.progressPercent === COMPLETE ? <CheckIcon /> : <PlayIcon />}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <p className="muted">Nenhum episódio carregado ainda. Envie a primeira legenda abaixo.</p>
      )}
      <button className="fab" onClick={() => openUpload(media.id)}>
        <UploadIcon /> Enviar legenda de outro episódio
      </button>
    </>
  );
}
