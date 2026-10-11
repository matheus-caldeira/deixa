"use client";

import Link from "next/link";
import { useState } from "react";
import type { LevelFit } from "@/shared/levels";
import { SearchIcon, UploadIcon } from "../icons";
import { useShell } from "../shell/app-shell";
import { Poster, type PosterData } from "./poster";

export type CatalogTile = PosterData & { id: string; fit: LevelFit; levelRange: string };
export type InProgressTile = {
  episodeId: string;
  mediaId: string;
  poster: PosterData;
  label: string;
  episodeTitle: string;
  progressPercent: number;
};

type Filter = "all" | "fit" | "series" | "movie";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "fit", label: "No meu nível" },
  { key: "series", label: "Séries" },
  { key: "movie", label: "Filmes" },
];

export const FIT_CHIP: Record<LevelFit, { label: string; className: string }> = {
  fit: { label: "No seu nível", className: "good" },
  challenging: { label: "Desafiador", className: "warn" },
  easy: { label: "Tranquilo", className: "" },
};

export function CatalogScreen({ tiles, inProgress }: { tiles: CatalogTile[]; inProgress: InProgressTile[] }) {
  const { openUpload } = useShell();
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
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>Explorar</h1>
      <label className="search">
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar série ou filme"
          autoComplete="off"
          aria-label="Buscar série ou filme"
        />
      </label>
      <div className="chips">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            className={`fchip ${filter === option.key ? "on" : ""}`}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {inProgress.length > 0 && !needle ? (
        <section className="col" style={{ gap: 10 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 18 }}>Em andamento</h2>
          </div>
          <div className="hscroll">
            {inProgress.map((entry) => (
              <Link
                key={entry.episodeId}
                className="cont card"
                style={{ padding: 10 }}
                href={`/catalog/${entry.mediaId}`}
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
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 18 }}>Catálogo</h2>
          <span className="small muted">{visible.length} títulos</span>
        </div>
        {visible.length > 0 ? (
          <div className="pgrid">
            {visible.map((tile) => (
              <Link key={tile.id} className="ptile" href={`/catalog/${tile.id}`} aria-label={tile.title}>
                <Poster media={tile} />
                <div className="meta">
                  <span className={`chip ${FIT_CHIP[tile.fit].className}`}>{FIT_CHIP[tile.fit].label}</span>
                  <span className="chip mono">{tile.levelRange}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">
            {needle
              ? `Nada encontrado para "${query}". Você pode buscar no TMDB e adicionar abaixo.`
              : "O catálogo ainda está vazio. Adicione o primeiro episódio abaixo."}
          </p>
        )}
      </section>
      <button className="fab" onClick={() => openUpload()}>
        <UploadIcon /> Adicionar episódio com legenda .srt
      </button>
    </>
  );
}
