"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  loadEpisodesAction,
  openUploadTargetAction,
  searchWorksAction,
  selectWorkAction,
  uploadSubtitlesAction,
} from "@/app/actions/catalog";
import type { ImportView, SearchResultView, UploadEpisodeView, UploadTargetView } from "@/operations/views";
import { posterColorsFor } from "@/modules/catalog";
import { LANGUAGE_TAGS, type LanguagePair } from "@/shared/study-languages";
import { CheckIcon, SearchIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { Poster } from "./poster";
import { SubtitleSourcePicker } from "./subtitle-source-picker";
import { routes } from "@/shared/routes";

const SEARCH_DEBOUNCE_MS = 350;
const STEP_REVEAL_MS = 420;
const MAX_FILE_BYTES = 5_000_000;
const MAX_FILE_MB = 5;
const MAX_SCRIPT_BYTES = 2_000_000;
const MAX_SCRIPT_MB = 2;

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
  const t = useTranslations("upload");
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
        <span className="chip">{t("soon")}</span>
      ) : (
        <span className="link small">{props.file ? t("change") : t("choose")}</span>
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

export function UploadSheet(props: {
  mediaId?: string;
  devShortcuts: boolean;
  pair: LanguagePair;
  onClose: () => void;
}) {
  const t = useTranslations("upload");
  const steps = useTranslations("processing");
  const languages = useTranslations("languages");
  const names = { target: languages(props.pair.target), native: languages(props.pair.native) };
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
  const [script, setScript] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
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
      setError(t("onlySrt"));
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      setError(t("tooLarge", { mb: MAX_FILE_MB }));
      return;
    }
    setError("");
    setter(file);
  }

  function pickScript(file: File | null) {
    if (file && !/\.txt$/i.test(file.name)) {
      setError(t("onlyTxt"));
      return;
    }
    if (file && file.size > MAX_SCRIPT_BYTES) {
      setError(t("tooLarge", { mb: MAX_SCRIPT_MB }));
      return;
    }
    setError("");
    setScript(file);
  }

  function submit(useSample: boolean) {
    if (!target) return;
    const form = new FormData();
    form.set("mediaId", target.mediaId);
    form.set("episodeId", episodeId);
    form.set("useSample", String(useSample));
    if (english) form.set("target", english);
    if (portuguese) form.set("native", portuguese);
    if (script) form.set("script", script);
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
  const selectedEpisode = episodes.find((episode) => episode.id === episodeId) ?? null;
  const episodeHasTarget =
    target?.type === "movie"
      ? (target.movieEpisode?.subtitleLanguages.includes(props.pair.target) ?? false)
      : (selectedEpisode?.subtitleLanguages.includes(props.pair.target) ?? false);
  const canSubmit = hasEpisode && (english !== null || (script !== null && episodeHasTarget));
  const finished = outcome !== null && revealed >= outcome.steps.length;

  return (
    <Sheet label={t("title")} onClose={props.onClose}>
      {stage === "search" ? (
        <>
          <h2 style={{ fontSize: 22 }}>{t("title")}</h2>
          <p className="small muted">{t("step1")}</p>
          <label className="search">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(null);
              }}
              placeholder={t("workName")}
              autoComplete="off"
              aria-label={t("workName")}
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
                    {t(work.type === "movie" ? "movie" : "series")}
                    {work.year ? ` · ${work.year}` : ""}
                    {work.originalTitle !== work.title ? ` · ${work.originalTitle}` : ""}
                    {work.inCatalog ? ` · ${t("inCatalog")}` : ""}
                  </span>
                </span>
              </button>
            ))}
            {searched && results.length === 0 && !error ? (
              <p className="small muted">{t("nothingFound", { query })}</p>
            ) : null}
          </div>
          {error ? <p className="formerr">{error}</p> : null}
          <button className="btn wide" onClick={continueWithSelected} disabled={!selected || pending}>
            {t("continue")}
          </button>
        </>
      ) : null}

      {stage === "files" && !target ? <p className="muted">{error || t("loading")}</p> : null}

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
                <span className="small muted">{t("originalTitle", { title: target.originalTitle })}</span>
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
            {t("step2")} {target.type === "movie" ? t("step2Movie") : t("step2Series")}{" "}
            {t("step2Native", names)}
          </p>

          {target.type === "series" ? (
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="upload-season">{t("season")}</label>
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
                <label htmlFor="upload-episode">{t("episode")}</label>
                <select
                  id="upload-episode"
                  value={episodeId}
                  onChange={(event) => setEpisodeId(event.target.value)}
                  disabled={episodes.length === 0}
                >
                  {episodes.length === 0 ? <option value="">{t("loading")}</option> : null}
                  {episodes.map((episode) => (
                    <option key={episode.id} value={episode.id}>
                      E{String(episode.episodeNumber).padStart(2, "0")} · {episode.title} (
                      {t(`status.${episode.status}`)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {manual ? (
            <>
              <Slot
                tag={LANGUAGE_TAGS[props.pair.target]}
                title={t("targetSubtitle", names)}
                hint={t("targetHint")}
                file={english}
                accept=".srt"
                inputLabel={t("targetFile", names)}
                onPick={(file) => pickFile(setEnglish, file)}
              />
              <Slot
                tag={LANGUAGE_TAGS[props.pair.native]}
                title={t("nativeSubtitle", names)}
                hint={t("nativeHint")}
                file={portuguese}
                accept=".srt"
                inputLabel={t("nativeFile", names)}
                onPick={(file) => pickFile(setPortuguese, file)}
              />
              <Slot
                tag="TXT"
                title={t("script")}
                hint={t("scriptHint")}
                file={script}
                accept=".txt"
                inputLabel={t("scriptFile")}
                onPick={pickScript}
              />
              {props.devShortcuts ? (
                <button
                  className="link"
                  style={{ alignSelf: "center" }}
                  onClick={() => submit(true)}
                  disabled={!hasEpisode || pending}
                >
                  {t("useSample", {
                    target: LANGUAGE_TAGS[props.pair.target],
                    native: LANGUAGE_TAGS[props.pair.native],
                  })}
                </button>
              ) : null}
              {error ? <p className="formerr">{error}</p> : null}
              <button className="btn wide" onClick={() => submit(false)} disabled={!canSubmit || pending}>
                {pending ? t("sending") : t("sendAndProcess")}
              </button>
              <button className="link" style={{ alignSelf: "center" }} onClick={() => setManual(false)}>
                {t("searchOpenSubtitles")}
              </button>
            </>
          ) : (
            <SubtitleSourcePicker
              key={episodeId}
              mediaId={target.mediaId}
              episodeId={episodeId}
              pair={props.pair}
              onManual={() => {
                setError("");
                setManual(true);
              }}
              onImported={(view) => {
                setOutcome(view);
                setRevealed(0);
                setStage("processing");
              }}
            />
          )}
        </>
      ) : null}

      {stage === "processing" && outcome ? (
        <>
          <h2 style={{ fontSize: 22 }}>{t("processing")}</h2>
          <p className="small muted mono">{outcome.filename}</p>
          <div className="col" style={{ gap: 12 }}>
            {outcome.steps.map((step, index) => {
              const state = index < revealed ? "done" : index === revealed ? "run" : "wait";
              return (
                <div key={step.key} className={`pstep ${state}`}>
                  <span className="s">{state === "done" ? <CheckIcon /> : null}</span>
                  <span>{steps(`steps.${step.key}`)}</span>
                  <span className="small muted mono">
                    {state === "wait" ? "" : steps(`details.${step.detail.key}`, step.detail.params)}
                  </span>
                </div>
              );
            })}
          </div>
          {finished ? (
            <>
              {outcome.outcome === "DUPLICATE" ? (
                <div className="hint">{t("duplicate")}</div>
              ) : (
                <div className="hint" style={{ background: "var(--good-soft)" }}>
                  {outcome.hasNative ? t("publishedBoth", names) : t("published")}
                </div>
              )}
              <button
                className="btn wide"
                onClick={() => {
                  props.onClose();
                  router.push(routes.work(outcome.mediaId, outcome.seasonNumber));
                  router.refresh();
                }}
              >
                {t("seeInCatalog")}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
