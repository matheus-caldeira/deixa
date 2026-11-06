"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { requestSongTranslationAction, saveSongTimingAction } from "@/app/actions/music";
import {
  activeCueIndex,
  lyricsToVideoMs,
  MAX_LEAD_IN_MS,
  MAX_PAUSES,
  videoToLyricsMs,
  type SongPause,
  type SongTiming,
} from "@/modules/music";
import type { ListenPageView } from "@/operations/views";
import type { DisplayMode } from "@/shared/levels";
import { LANGUAGE_TAGS } from "@/shared/study-languages";
import { BackIcon, MarkerIcon, PauseIcon, PlayIcon, SlidersIcon, SparkIcon, XIcon } from "../icons";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";
import { useTransport } from "./use-transport";

type ListenMode = DisplayMode | "native";

const MODES: ListenMode[] = ["both", "tap", "en", "native"];
const MS_PER_SECOND = 1000;
const NUDGES_MS = [-500, -100, 100, 500];
const DEFAULT_PAUSE_SECONDS = 10;
const TRANSLATION_POLL_MS = 4000;
const TRANSLATION_POLL_LIMIT = 8;

const clampLeadIn = (value: number) => Math.min(MAX_LEAD_IN_MS, Math.max(0, Math.round(value)));

export function ListenScreen({ view }: { view: ListenPageView }) {
  const t = useTranslations("music");
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const errorText = useErrorText();
  const [saving, startSaving] = useTransition();
  const tags = { target: LANGUAGE_TAGS[view.pair.target], native: LANGUAGE_TAGS[view.pair.native] };
  const { mountRef, ...transport } = useTransport(view.youtubeVideoId);
  const [mode, setMode] = useState<ListenMode>(view.hasNative ? view.defaultMode : "en");
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(-1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [timing, setTiming] = useState<SongTiming>(view.timing);
  const [savedTiming, setSavedTiming] = useState<SongTiming>(view.timing);
  const [pauseSeconds, setPauseSeconds] = useState(String(DEFAULT_PAUSE_SECONDS));
  const [videoMs, setVideoMs] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const [requested, setRequested] = useState(false);
  const linesRef = useRef<HTMLDivElement>(null);
  const timingRef = useRef(timing);
  const activeRef = useRef(-1);
  const lastSecondRef = useRef(-1);
  const transportRef = useRef(transport);

  useEffect(() => {
    timingRef.current = timing;
    transportRef.current = transport;
  });

  const sourceLabel = view.translationSource === "llm" ? t("sourceAi") : tags.native;
  const dirty = JSON.stringify(timing) !== JSON.stringify(savedTiming);
  const lyricsNow = useMemo(() => videoToLyricsMs(videoMs, timing), [videoMs, timing]);

  const centerLine = useCallback((index: number) => {
    const container = linesRef.current;
    const line = container?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!container || !line) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      top: line.offsetTop - container.clientHeight / 2 + line.offsetHeight / 2,
      behavior: reduced ? "auto" : "smooth",
    });
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const ms = transportRef.current.currentMs();
      const next = activeCueIndex(view.cues, videoToLyricsMs(ms, timingRef.current));
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
        if (next >= 0) centerLine(next);
      }
      const second = Math.floor(ms / MS_PER_SECOND);
      if (second !== lastSecondRef.current) {
        lastSecondRef.current = second;
        setVideoMs(ms);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [view.cues, centerLine]);

  useEffect(() => {
    if (!requested || view.hasNative || pollCount >= TRANSLATION_POLL_LIMIT) return;
    const timer = setTimeout(() => {
      setPollCount((count) => count + 1);
      router.refresh();
    }, TRANSLATION_POLL_MS);
    return () => clearTimeout(timer);
  }, [requested, view.hasNative, pollCount, router]);

  const seekToCue = (index: number) => {
    const cue = view.cues[index];
    if (!cue) return;
    transport.seekMs(lyricsToVideoMs(cue.startMs, timing));
    transport.play();
    setRevealed((current) => new Set(current).add(cue.cueId));
  };

  const seconds = (ms: number) =>
    format.number(ms / MS_PER_SECOND, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const nudge = (delta: number) =>
    setTiming((current) => ({ ...current, leadInMs: clampLeadIn(current.leadInMs + delta) }));

  const firstLineNow = () => {
    const first = view.cues[0];
    if (!first) return;
    const ms = transport.currentMs();
    const before = timing.pauses
      .filter((pause) => pause.atMs <= first.startMs)
      .reduce((total, pause) => total + pause.durationMs, 0);
    setTiming((current) => ({ ...current, leadInMs: clampLeadIn(ms - first.startMs - before) }));
  };

  const addPause = () => {
    const durationMs = Math.round(Number(pauseSeconds.replace(",", ".")) * MS_PER_SECOND);
    if (!Number.isFinite(durationMs) || durationMs < 1 || timing.pauses.length >= MAX_PAUSES) return;
    const atMs = Math.round(videoToLyricsMs(transport.currentMs(), timing));
    const pause: SongPause = { atMs, durationMs };
    setTiming((current) => ({
      ...current,
      pauses: [...current.pauses, pause].sort((a, b) => a.atMs - b.atMs),
    }));
  };

  const removePause = (index: number) =>
    setTiming((current) => ({ ...current, pauses: current.pauses.filter((_, i) => i !== index) }));

  const save = () =>
    startSaving(async () => {
      const result = await saveSongTimingAction({
        episodeId: view.episodeId,
        leadInMs: timing.leadInMs,
        pauses: timing.pauses,
      }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      setSavedTiming(timing);
      toast(t("timingSaved"));
    });

  const translate = () =>
    startSaving(async () => {
      const result = await requestSongTranslationAction({ episodeId: view.episodeId }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      setRequested(true);
      setPollCount(0);
      toast(t("translationRequested"));
    });

  const modeLabel = (option: ListenMode) =>
    option === "both"
      ? t("modes.both")
      : option === "tap"
        ? t("modes.tap")
        : option === "en"
          ? tags.target
          : tags.native;

  return (
    <div className="listen">
      <div className="listenhead">
        <div className="row" style={{ alignItems: "center", gap: 10 }}>
          <Link className="iconbtn" href={view.backHref} aria-label={t("back")}>
            <BackIcon />
          </Link>
          <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
            <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{view.title}</b>
            <span
              className="small muted"
              style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {view.artist}
            </span>
          </div>
          <Link className="btn" style={{ padding: "8px 12px", fontSize: 13 }} href={view.readHref}>
            <MarkerIcon width={16} height={16} /> {t("readAndMark")}
          </Link>
        </div>
        <div className="player" data-testid="player" data-mode={transport.mode}>
          <div ref={mountRef} hidden={transport.mode === "clock"} />
          {transport.mode === "clock" ? (
            <div className="clock" data-testid="clock">
              <button
                className="playbtn"
                onClick={transport.playing ? transport.pause : transport.play}
                aria-label={transport.playing ? t("pause") : t("play")}
              >
                {transport.playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <span>{seconds(videoMs)} s</span>
            </div>
          ) : null}
        </div>
        {transport.mode === "clock" ? (
          <p className="note" role="status" style={{ margin: 0 }}>
            {t("playerFailed")}
          </p>
        ) : null}
        <div className="seg">
          {MODES.map((option) => (
            <button
              key={option}
              className={mode === option ? "on" : ""}
              onClick={() => {
                setMode(option);
                setRevealed(new Set());
              }}
              disabled={!view.hasNative && option !== "en"}
            >
              {modeLabel(option)}
            </button>
          ))}
        </div>
        <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {view.hasNative ? (
            <span className="chip" data-testid="translation-source">
              {t("translationBy", { source: sourceLabel })}
            </span>
          ) : (
            <>
              <span className="small muted">{t("noTranslation")}</span>
              {view.canEdit ? (
                <button
                  className="btn"
                  style={{ padding: "6px 10px", fontSize: 13 }}
                  onClick={translate}
                  disabled={saving}
                >
                  <SparkIcon width={14} height={14} /> {requested ? t("translating") : t("translateWithAi")}
                </button>
              ) : null}
            </>
          )}
          <span className="spacer" />
          <button
            className="iconbtn"
            onClick={() => setPanelOpen((open) => !open)}
            aria-label={t("sync.title")}
            aria-expanded={panelOpen}
          >
            <SlidersIcon />
          </button>
        </div>
      </div>
      <div className="lyrics" ref={linesRef} data-testid="lyrics">
        {view.cues.length === 0 ? <p className="muted">{t("noLyrics")}</p> : null}
        {view.cues.map((cue, index) => {
          const showTranslation =
            cue.translation !== null &&
            (mode === "both" || mode === "native" || (mode === "tap" && revealed.has(cue.cueId)));
          const showTarget = mode !== "native" || cue.translation === null;
          return (
            <button
              key={cue.cueId}
              data-index={index}
              className={`lyric ${index === active ? "now" : index < active ? "past" : ""}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => seekToCue(index)}
            >
              {showTarget ? cue.text : null}
              {showTranslation ? (
                <span className="sub">
                  <span className="src">{sourceLabel}</span>
                  {cue.translation}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {panelOpen ? (
        <div className="syncpanel" data-testid="sync-panel">
          <div className="row" style={{ alignItems: "center" }}>
            <b>{t("sync.title")}</b>
            <span className="spacer" />
            <button className="iconbtn" onClick={() => setPanelOpen(false)} aria-label={t("sync.close")}>
              <XIcon />
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {t("sync.hint", { lyrics: seconds(lyricsNow) })}
          </p>
          {view.canEdit ? (
            <>
              <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="small">{t("sync.leadIn", { seconds: seconds(timing.leadInMs) })}</span>
                <div className="nudges">
                  {NUDGES_MS.map((delta) => (
                    <button key={delta} className="fchip" onClick={() => nudge(delta)}>
                      {delta > 0 ? "+" : "−"}
                      {seconds(Math.abs(delta))}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn" onClick={firstLineNow} disabled={view.cues.length === 0}>
                {t("sync.firstLineNow")}
              </button>
              <div className="field">
                <label htmlFor="pause-seconds">{t("sync.pauseSeconds")}</label>
                <input
                  id="pause-seconds"
                  inputMode="decimal"
                  value={pauseSeconds}
                  onChange={(event) => setPauseSeconds(event.target.value)}
                />
              </div>
              <button className="btn" onClick={addPause} disabled={timing.pauses.length >= MAX_PAUSES}>
                {t("sync.addPause")}
              </button>
              {timing.pauses.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  {t("sync.noPauses")}
                </p>
              ) : (
                timing.pauses.map((pause, index) => (
                  <div key={`${pause.atMs}-${index}`} className="row" style={{ alignItems: "center" }}>
                    <span className="small">
                      {t("sync.pauseItem", { at: seconds(pause.atMs), duration: seconds(pause.durationMs) })}
                    </span>
                    <span className="spacer" />
                    <button
                      className="iconbtn"
                      onClick={() => removePause(index)}
                      aria-label={t("sync.removePause")}
                    >
                      <XIcon />
                    </button>
                  </div>
                ))
              )}
              <button className="btn block" onClick={save} disabled={!dirty || saving}>
                {saving ? t("saving") : t("sync.save")}
              </button>
            </>
          ) : (
            <p className="note" style={{ margin: 0 }}>
              {t("sync.ownerOnly")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
