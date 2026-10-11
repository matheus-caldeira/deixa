"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  loadEpisodesAction,
  openUploadTargetAction,
  searchWorksAction,
  selectWorkAction,
  uploadSubtitlesAction,
} from "@/app/actions/catalog";
import type { ImportView, SearchResultView, UploadEpisodeView, UploadTargetView } from "@/app/actions/views";
import { posterColorsFor } from "@/modules/catalog";
import { CheckIcon, SearchIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { Poster } from "./poster";

const SEARCH_DEBOUNCE_MS = 350;
const STEP_REVEAL_MS = 420;
const MAX_FILE_BYTES = 5_000_000;
const STATUS_LABEL: Record<string, string> = {
  READY: "pronto",
  PROCESSING: "processando",
  UPLOADED: "processando",
  NEEDS_REVIEW: "em revisão",
  FAILED: "falhou",
  NONE: "sem legenda",
};

type Stage = "search" | "files" | "processing";

function Slot(props: {
  tag: string;
  title: string;
  hint: string;
  file: File | null;
  accept: string;
  inputLabel: string;
  disabled?: boolean;
  onPick: (file: File | null) => void;
}) {
  return (
    <label
      className={`slot ${props.file ? "ok" : ""}`}
      style={props.disabled ? { opacity: 0.6, cursor: "default" } : undefined}
    >
      <span className="ic">{props.file ? <CheckIcon width={20} height={20} /> : props.tag}</span>
      <span className="col" style={{ gap: 1, minWidth: 0 }}>
        <b className="small">{props.title}</b>
        <span className="small muted" style={{ overflowWrap: "anywhere" }}>
          {props.file ? props.file.name : props.hint}
        </span>
      </span>
      {props.disabled ? (
        <span className="chip">Em breve</span>
      ) : (
        <span className="link small">{props.file ? "Trocar" : "Escolher"}</span>
      )}
      <input
        type="file"
        accept={props.accept}
        hidden
        disabled={props.disabled}
        aria-label={props.inputLabel}
        onChange={(event) => props.onPick(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function UploadSheet(props: { mediaId?: string; devShortcuts: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>(props.mediaId ? "files" : "search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultView[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<SearchResultView | null>(null);
  const [target, setTarget] = useState<UploadTargetView | null>(null);
  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<UploadEpisodeView[]>([]);
  const [episodeId, setEpisodeId] = useState("");
  const [english, setEnglish] = useState<File | null>(null);
  const [portuguese, setPortuguese] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<ImportView | null>(null);
  const [revealed, setRevealed] = useState(0);
  const searchSequence = useRef(0);

  useEffect(() => {
    if (stage !== "search") return;
    const sequence = ++searchSequence.current;
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      const result = await searchWorksAction(query);
      if (sequence !== searchSequence.current) return;
      setSearched(true);
      if (result.ok) {
        setResults(result.data);
        setError("");
      } else {
        setResults([]);
        setError(result.message);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, stage]);

  useEffect(() => {
    if (!outcome || revealed >= outcome.steps.length) return;
    const timer = setTimeout(() => setRevealed((count) => count + 1), STEP_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [outcome, revealed]);

  const pickSeason = useCallback((mediaId: string, number: number) => {
    setSeasonNumber(number);
    setEpisodes([]);
    setEpisodeId("");
    startTransition(async () => {
      const result = await loadEpisodesAction({ mediaId, seasonNumber: number });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEpisodes(result.data);
      setEpisodeId(result.data.find((episode) => episode.status === "NONE")?.id ?? result.data[0]?.id ?? "");
    });
  }, []);

  const applyTarget = useCallback(
    (next: UploadTargetView) => {
      setTarget(next);
      setStage("files");
      setError("");
      if (next.type === "movie") {
        setEpisodeId(next.movieEpisode?.id ?? "");
        return;
      }
      const first = next.seasons[0];
      if (first) pickSeason(next.mediaId, first.seasonNumber);
    },
    [pickSeason],
  );

  useEffect(() => {
    if (!props.mediaId) return;
    let cancelled = false;
    openUploadTargetAction(props.mediaId).then((result) => {
      if (cancelled) return;
      if (result.ok) applyTarget(result.data);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [applyTarget, props.mediaId]);

  function continueWithSelected() {
    if (!selected) return;
    startTransition(async () => {
      const result = await selectWorkAction({ type: selected.type, externalId: selected.externalId });
      if (result.ok) applyTarget(result.data);
      else setError(result.message);
    });
  }

  function pickFile(setter: (file: File | null) => void, file: File | null) {
    if (file && !/\.srt$/i.test(file.name)) {
      setError("Envie um arquivo .srt. Outros formatos ainda não são aceitos.");
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setError("Arquivo maior que 5 MB. Confira se é o arquivo certo.");
      return;
    }
    setError("");
    setter(file);
  }

  function submit(useSample: boolean) {
    if (!target) return;
    const form = new FormData();
    form.set("mediaId", target.mediaId);
    form.set("episodeId", episodeId);
    form.set("useSample", String(useSample));
    if (english) form.set("english", english);
    if (portuguese) form.set("portuguese", portuguese);
    setError("");
    startTransition(async () => {
      const result = await uploadSubtitlesAction(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOutcome(result.data);
      setRevealed(0);
      setStage("processing");
    });
  }

  const hasEpisode = episodeId !== "";
  const finished = outcome !== null && revealed >= outcome.steps.length;

  return (
    <Sheet label="Adicionar ao catálogo" onClose={props.onClose}>
      {stage === "search" ? (
        <>
          <h2 style={{ fontSize: 22 }}>Adicionar ao catálogo</h2>
          <p className="small muted">Passo 1 de 3 · Encontre a obra (metadados via TMDB).</p>
          <label className="search">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              placeholder="Nome da série ou filme"
              autoComplete="off"
              aria-label="Nome da série ou filme"
            />
          </label>
          <div className="col">
            {results.map((work) => (
              <button
                key={`${work.type}:${work.externalId}`}
                className={`result ${selected?.externalId === work.externalId ? "on" : ""}`}
                onClick={() => setSelected(work)}
              >
                <Poster
                  sizes="44px"
                  media={{
                    title: work.title,
                    type: work.type,
                    year: work.year,
                    posterUrl: work.posterUrl,
                    posterColors: work.posterColors ?? posterColorsFor(work.title),
                  }}
                />
                <span className="col" style={{ gap: 2, minWidth: 0 }}>
                  <b>{work.title}</b>
                  <span className="small muted">
                    {work.type === "movie" ? "Filme" : "Série"}
                    {work.year ? ` · ${work.year}` : ""}
                    {work.originalTitle !== work.title ? ` · ${work.originalTitle}` : ""}
                    {work.inCatalog ? " · já no catálogo" : ""}
                  </span>
                </span>
              </button>
            ))}
            {searched && results.length === 0 && !error ? (
              <p className="small muted">
                Nada encontrado no TMDB para &quot;{query}&quot;. Tente o título original.
              </p>
            ) : null}
          </div>
          {error ? <p className="formerr">{error}</p> : null}
          <button className="btn wide" onClick={continueWithSelected} disabled={!selected || pending}>
            Continuar
          </button>
        </>
      ) : null}

      {stage === "files" && !target ? <p className="muted">{error || "Carregando…"}</p> : null}

      {stage === "files" && target ? (
        <>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ width: 72, flex: "none" }}>
              <Poster
                sizes="72px"
                media={{
                  title: target.title,
                  type: target.type,
                  year: target.year,
                  posterUrl: target.posterUrl,
                  posterColors: target.posterColors,
                }}
              />
            </div>
            <div className="col" style={{ gap: 4, minWidth: 0 }}>
              <h2 style={{ fontSize: 22 }}>{target.title}</h2>
              {target.originalTitle !== target.title ? (
                <span className="small muted">Título original: {target.originalTitle}</span>
              ) : null}
              {target.overview ? (
                <p
                  className="small muted"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {target.overview}
                </p>
              ) : null}
            </div>
          </div>
          <p className="small muted">
            Passo 2 de 3 ·{" "}
            {target.type === "movie"
              ? "Envie as legendas do filme."
              : "Escolha o episódio e envie as legendas."}{" "}
            Com a legenda em português, a tradução das falas não passa pela IA.
          </p>

          {target.type === "series" ? (
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="upload-season">Temporada</label>
                <select
                  id="upload-season"
                  value={seasonNumber ?? ""}
                  onChange={(event) => pickSeason(target.mediaId, Number(event.target.value))}
                >
                  {target.seasons.map((season) => (
                    <option key={season.seasonNumber} value={season.seasonNumber}>
                      {season.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 2, minWidth: 0 }}>
                <label htmlFor="upload-episode">Episódio</label>
                <select
                  id="upload-episode"
                  value={episodeId}
                  onChange={(event) => setEpisodeId(event.target.value)}
                  disabled={episodes.length === 0}
                >
                  {episodes.length === 0 ? <option value="">Carregando…</option> : null}
                  {episodes.map((episode) => (
                    <option key={episode.id} value={episode.id}>
                      E{String(episode.episodeNumber).padStart(2, "0")} · {episode.title} (
                      {STATUS_LABEL[episode.status]})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <Slot
            tag="EN"
            title="Legenda em inglês"
            hint=".srt · obrigatória"
            file={english}
            accept=".srt"
            inputLabel="Arquivo da legenda em inglês"
            onPick={(file) => pickFile(setEnglish, file)}
          />
          <Slot
            tag="PT"
            title="Legenda em português"
            hint=".srt · opcional · as falas já chegam traduzidas, sem gastar IA"
            file={portuguese}
            accept=".srt"
            inputLabel="Arquivo da legenda em português"
            onPick={(file) => pickFile(setPortuguese, file)}
          />
          <Slot
            tag="TXT"
            title="Roteiro ou transcrição"
            hint=".txt ou .pdf · chega numa próxima fase"
            file={null}
            accept=".txt,.pdf"
            inputLabel="Arquivo de roteiro"
            disabled
            onPick={() => undefined}
          />
          {props.devShortcuts ? (
            <button
              className="link"
              style={{ alignSelf: "center" }}
              onClick={() => submit(true)}
              disabled={!hasEpisode || pending}
            >
              Usar arquivos de exemplo (EN + PT)
            </button>
          ) : null}
          {error ? <p className="formerr">{error}</p> : null}
          <button
            className="btn wide"
            onClick={() => submit(false)}
            disabled={!english || !hasEpisode || pending}
          >
            {pending ? "Enviando…" : "Enviar e processar"}
          </button>
        </>
      ) : null}

      {stage === "processing" && outcome ? (
        <>
          <h2 style={{ fontSize: 22 }}>Processando</h2>
          <p className="small muted mono">{outcome.filename}</p>
          <div className="col" style={{ gap: 12 }}>
            {outcome.steps.map((step, index) => {
              const state = index < revealed ? "done" : index === revealed ? "run" : "wait";
              return (
                <div key={step.label} className={`pstep ${state}`}>
                  <span className="s">{state === "done" ? <CheckIcon /> : null}</span>
                  <span>{step.label}</span>
                  <span className="small muted mono">{state === "wait" ? "" : step.detail}</span>
                </div>
              );
            })}
          </div>
          {finished ? (
            <>
              {outcome.outcome === "DUPLICATE" ? (
                <div className="hint">
                  Essa legenda já existe no catálogo. Nada foi reprocessado e o episódio já está disponível
                  para todas as contas.
                </div>
              ) : (
                <div className="hint" style={{ background: "var(--good-soft)" }}>
                  Episódio publicado. Já dá para ler a legenda inteira
                  {outcome.hasPortuguese ? " em inglês e português" : ""}; o áudio de cada fala é gerado no
                  primeiro toque. Todas as contas veem o episódio sem novo upload.
                </div>
              )}
              <button
                className="btn wide"
                onClick={() => {
                  props.onClose();
                  router.push(`/catalog/${outcome.mediaId}?season=${outcome.seasonNumber}`);
                  router.refresh();
                }}
              >
                Ver no catálogo
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
