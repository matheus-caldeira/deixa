"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  confirmCardsAction,
  getCardBatchAction,
  startCardGenerationAction,
  syncHighlightsAction,
  translateCueAction,
  type SavedHighlightView,
} from "@/app/actions/reading";
import { tokenRuns } from "@/modules/highlights";
import type { CardDraft } from "@/modules/learning";
import type { DisplayMode } from "@/shared/levels";
import { LANGUAGE_TAGS, type LanguagePair } from "@/shared/study-languages";
import { formatTimecode } from "@/shared/time";
import { BackIcon, CheckIcon, MarkerIcon, SearchIcon, SoundIcon, SparkIcon, XIcon } from "../icons";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";
import { useSpeech } from "../shell/use-speech";

export type ReadLine = {
  cueId: string;
  startMs: number;
  tokens: string[];
  sceneIndex: number;
  startsScene: boolean;
  translation: string | null;
  translationSource: "subtitle_pt" | "llm" | null;
  markedByCount: number | null;
};

export type ReadView = {
  episodeId: string;
  backHref: string;
  mediaTitle: string;
  label: string;
  episodeTitle: string;
  hasNative: boolean;
  pair: LanguagePair;
  subtitleCredits: string[];
  defaultMode: DisplayMode;
  audioSpeed: number;
  lines: ReadLine[];
  highlights: SavedHighlightView[];
  suggestions: { cueId: string; startToken: number; endToken: number; term: string }[];
  cachedAudioCueIds: string[];
  openBatchId: string | null;
};

type GeneratedCards = {
  batchId: string;
  drafts: CardDraft[];
  translationsFromSubtitle: number;
  simulated: boolean;
};

const MODES: DisplayMode[] = ["both", "tap", "en"];
const GENERATION_STEPS = ["group", "translate", "explain", "validate", "assemble"];
const SYNC_DELAY_MS = 700;
const STEP_MS = 450;
const POLL_MS = 1500;

type Stage = "read" | "generating";
type Marks = Record<string, number[]>;

const keyOf = (cueId: string, start: number, end: number, kind: string) => `${cueId}:${start}:${end}:${kind}`;

function initialMarks(highlights: SavedHighlightView[]): Marks {
  const marks: Marks = {};
  for (const highlight of highlights) {
    if (highlight.kind === "line") continue;
    const tokens = marks[highlight.cueId] ?? [];
    for (let token = highlight.startToken; token <= highlight.endToken; token += 1) tokens.push(token);
    marks[highlight.cueId] = tokens;
  }
  return marks;
}

const cardedKeys = (highlights: SavedHighlightView[]) =>
  new Set(highlights.filter((h) => h.carded).map((h) => keyOf(h.cueId, h.startToken, h.endToken, h.kind)));

export function ReadScreen({ view }: { view: ReadView }) {
  const t = useTranslations("read");
  const errorText = useErrorText();
  const tags = { target: LANGUAGE_TAGS[view.pair.target], native: LANGUAGE_TAGS[view.pair.native] };
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [marks, setMarks] = useState<Marks>(() => initialMarks(view.highlights));
  const [wholeLines, setWholeLines] = useState<Set<string>>(
    () => new Set(view.highlights.filter((h) => h.kind === "line").map((h) => h.cueId)),
  );
  const [carded, setCarded] = useState(() => cardedKeys(view.highlights));
  const [mode, setMode] = useState<DisplayMode>(view.defaultMode);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [translations, setTranslations] = useState<
    Record<string, { text: string; source: "subtitle_pt" | "llm" }>
  >({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage>(view.openBatchId ? "generating" : "read");
  const [batchId, setBatchId] = useState<string | null>(view.openBatchId);
  const [step, setStep] = useState(0);
  const [generated, setGenerated] = useState<GeneratedCards | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [scope, setScope] = useState<"private" | "catalog">("private");
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const speech = useSpeech({ speed: view.audioSpeed, onError: toast });
  const cachedAudio = useMemo(() => new Set(view.cachedAudioCueIds), [view.cachedAudioCueIds]);

  const payload = useCallback(
    () => ({
      episodeId: view.episodeId,
      marks: view.lines
        .map((line) => ({
          cueId: line.cueId,
          tokens: marks[line.cueId] ?? [],
          wholeLine: wholeLines.has(line.cueId),
        }))
        .filter((mark) => mark.tokens.length > 0 || mark.wholeLine),
    }),
    [marks, view.episodeId, view.lines, wholeLines],
  );

  useEffect(() => {
    if (!dirty.current || stage !== "read") return;
    const timer = setTimeout(async () => {
      dirty.current = false;
      const result = await syncHighlightsAction(payload());
      if (result.ok) setCarded(cardedKeys(result.data));
      else toast(result.message);
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [payload, stage, toast]);

  const pendingCount = useMemo(() => {
    let count = 0;
    for (const line of view.lines) {
      for (const [start, end] of tokenRuns(marks[line.cueId] ?? [])) {
        if (!carded.has(keyOf(line.cueId, start, end, start === end ? "word" : "phrase"))) count += 1;
      }
      if (wholeLines.has(line.cueId) && !carded.has(keyOf(line.cueId, 0, line.tokens.length - 1, "line"))) {
        count += 1;
      }
    }
    return count;
  }, [carded, marks, view.lines, wholeLines]);

  const toggleWord = (cueId: string, token: number) => {
    dirty.current = true;
    setMarks((current) => {
      const tokens = current[cueId] ?? [];
      return {
        ...current,
        [cueId]: tokens.includes(token) ? tokens.filter((t) => t !== token) : [...tokens, token],
      };
    });
  };

  const toggleLine = (cueId: string) => {
    dirty.current = true;
    setWholeLines((current) => {
      const next = new Set(current);
      if (next.has(cueId)) next.delete(cueId);
      else next.add(cueId);
      return next;
    });
  };

  const applySuggestion = (cueId: string, start: number, end: number) => {
    dirty.current = true;
    setMarks((current) => {
      const tokens = new Set(current[cueId] ?? []);
      for (let token = start; token <= end; token += 1) tokens.add(token);
      return { ...current, [cueId]: [...tokens] };
    });
  };

  const translate = (cueId: string) => {
    if (translatingId) return;
    setTranslatingId(cueId);
    startTransition(async () => {
      const result = await translateCueAction(cueId);
      setTranslatingId(null);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setTranslations((current) => ({ ...current, [cueId]: result.data }));
      setRevealed((current) => new Set(current).add(cueId));
    });
  };

  const generate = () => {
    dirty.current = false;
    setStage("generating");
    setStep(0);
    setGenerated(null);
    setBatchId(null);
    setRemoved(new Set());
    window.scrollTo(0, 0);
    startCardGenerationAction(payload())
      .then((result) => {
        if (result.ok) {
          setBatchId(result.data.batchId);
          return;
        }
        toast(result.message);
        setStage("read");
      })
      .catch(() => {
        toast(t("offlineSaved"));
        setStage("read");
      });
  };

  useEffect(() => {
    if (stage !== "generating" || !batchId || generated) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const result = await getCardBatchAction(batchId).catch(() => null);
      if (cancelled) return;
      if (result?.ok && result.data.status === "DRAFT") {
        setGenerated({
          batchId: result.data.batchId,
          drafts: result.data.drafts,
          translationsFromSubtitle: result.data.translationsFromSubtitle,
          simulated: result.data.simulated,
        });
        return;
      }
      if (result?.ok && result.data.status === "FAILED") {
        toast(errorText(result.data.reason));
        setStage("read");
        return;
      }
      if (result?.ok && result.data.status === "SAVED") {
        setStage("read");
        router.replace(`/read/${view.episodeId}`);
        return;
      }
      if (result && !result.ok) {
        toast(result.message);
        setStage("read");
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS / 3);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [batchId, errorText, generated, router, stage, toast, view.episodeId]);

  useEffect(() => {
    if (stage !== "generating") return;
    const lastWaitingStep = GENERATION_STEPS.length - 2;
    if (step >= GENERATION_STEPS.length) return;
    if (!generated && step >= lastWaitingStep) return;
    const timer = setTimeout(() => setStep((current) => current + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [generated, stage, step]);

  const keptDrafts = generated ? generated.drafts.filter((draft) => !removed.has(draft.key)) : [];

  const save = () => {
    if (!generated) return;
    setSaving(true);
    confirmCardsAction({
      batchId: generated.batchId,
      keepKeys: keptDrafts.map((draft) => draft.key),
      scope,
    })
      .then((result) => {
        setSaving(false);
        if (!result.ok) {
          toast(result.message);
          return;
        }
        toast(
          t(scope === "catalog" ? "savedCatalog" : "savedPrivate", {
            count: result.data.cardsKept,
            xp: result.data.xpAwarded,
          }),
        );
        router.push("/review");
        router.refresh();
      })
      .catch(() => {
        setSaving(false);
        toast(errorText(null));
      });
  };

  const generationFinished = stage === "generating" && generated !== null && step >= GENERATION_STEPS.length;

  if (stage === "generating" && !generationFinished) {
    return (
      <div className="tx">
        <div className="done" style={{ justifyContent: "flex-start", paddingTop: 48 }}>
          <div style={{ width: 64, height: 64, color: "var(--brand)" }}>
            <SparkIcon />
          </div>
          <h1 style={{ fontSize: 26 }}>{t("creatingCards")}</h1>
          <div className="col" style={{ gap: 14, width: "100%", textAlign: "left" }}>
            {GENERATION_STEPS.map((entry, index) => {
              const state = index < step ? "done" : index === step ? "run" : "wait";
              return (
                <div key={entry} className={`pstep ${state}`}>
                  <span className="s">{state === "done" ? <CheckIcon /> : null}</span>
                  <span>{t(`generation.${entry}`)}</span>
                  <span className="small muted mono" />
                </div>
              );
            })}
          </div>
          <p className="small muted">{t("generationBody")}</p>
          <button
            className="btn ghost"
            onClick={() => {
              setStage("read");
              toast(t("willNotify"));
            }}
          >
            {t("keepReading")}
          </button>
        </div>
      </div>
    );
  }

  if (generationFinished && generated) {
    const allFromSubtitle =
      generated.drafts.length > 0 && generated.translationsFromSubtitle === generated.drafts.length;
    return (
      <div className="tx">
        <div className="txhead">
          <div className="row">
            <button className="iconbtn" onClick={() => setStage("read")} aria-label={t("backToSubtitle")}>
              <BackIcon />
            </button>
            <div className="col" style={{ gap: 0, flex: 1 }}>
              <b>{t("episodeCards")}</b>
              <span className="small muted">
                {view.mediaTitle} · {view.label}
              </span>
            </div>
            <span className="chip mono">{t("cardsCount", { count: keptDrafts.length })}</span>
          </div>
          <div className="seg">
            <button className={scope === "private" ? "on" : ""} onClick={() => setScope("private")}>
              {t("scopePrivate")}
            </button>
            <button className={scope === "catalog" ? "on" : ""} onClick={() => setScope("catalog")}>
              {t("scopeCatalog")}
            </button>
          </div>
          <p className="small muted">{scope === "private" ? t("scopePrivateBody") : t("scopeCatalogBody")}</p>
        </div>
        <div className="txlines" style={{ gap: 12, paddingTop: 14 }}>
          {allFromSubtitle ? (
            <div className="hint" style={{ background: "var(--good-soft)" }}>
              <span>
                {t.rich("fromSubtitle", {
                  ...tags,
                  b: (chunks) => <b style={{ color: "var(--good)" }}>{chunks}</b>,
                })}
              </span>
            </div>
          ) : null}
          {generated.simulated ? (
            <div className="hint">
              <span>
                <b>{t("simulated")}</b> {t("simulatedBody")}
              </span>
            </div>
          ) : null}
          {keptDrafts.length === 0 ? <p className="muted">{t("allRemoved")}</p> : null}
          {keptDrafts.map((draft) => {
            const lineTokens = draft.lineText.split(/\s+/);
            const fromSubtitle = draft.lineTranslationSource === "subtitle_pt";
            return (
              <div className="gcard" key={draft.key}>
                <div className="col" style={{ gap: 6, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="chip">{t(`itemType.${draft.itemType}`)}</span>
                    <span className="small muted mono">{formatTimecode(draft.startMs)}</span>
                  </div>
                  <div className="term">{draft.term}</div>
                  <div
                    className="small"
                    style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}
                  >
                    <span className={`srcb ${draft.meaningSource === "subtitle_pt" ? "pt" : "ai"}`}>
                      {draft.meaningSource === "subtitle_pt" ? t("fromNativeSubtitle", tags) : t("ai")}
                    </span>
                    <span>{draft.meaning}</span>
                  </div>
                </div>
                <button
                  className="iconbtn"
                  onClick={() => setRemoved((current) => new Set(current).add(draft.key))}
                  aria-label={t("removeCard", { term: draft.term })}
                >
                  <XIcon />
                </button>
                {draft.kind === "line" ? null : (
                  <div className="ctx">
                    <span>
                      {lineTokens.map((token, index) => (
                        <span key={index}>
                          {index >= draft.startToken && index <= draft.endToken ? (
                            <mark>{token}</mark>
                          ) : (
                            token
                          )}{" "}
                        </span>
                      ))}
                    </span>
                    {draft.lineTranslation ? (
                      <span className="muted">
                        <span className={`srcb ${fromSubtitle ? "pt" : "ai"}`} style={{ marginRight: 6 }}>
                          {fromSubtitle ? tags.native : t("ai")}
                        </span>
                        {draft.lineTranslation}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="txfoot">
          <button className="btn wide" onClick={save} disabled={keptDrafts.length === 0 || saving}>
            {saving ? t("saving") : t("addToReview", { count: keptDrafts.length })}
          </button>
        </div>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const visibleLines = view.lines.filter((line) => {
    if (!needle) return true;
    const translation = translations[line.cueId]?.text ?? line.translation ?? "";
    return line.tokens.join(" ").toLowerCase().includes(needle) || translation.toLowerCase().includes(needle);
  });

  return (
    <div className="tx">
      <div className="txhead">
        <div className="row">
          <Link className="iconbtn" href={view.backHref} aria-label={t("back")}>
            <BackIcon />
          </Link>
          <div className="col" style={{ gap: 0, flex: 1, minWidth: 0 }}>
            <b>
              {view.mediaTitle} · {view.label}
            </b>
            <span
              className="small muted"
              style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {view.episodeTitle} · {view.hasNative ? t("subtitleAligned", tags) : t("subtitleAiOnly", tags)}
            </span>
            {view.subtitleCredits.map((credit) => (
              <span
                key={credit}
                className="small muted"
                style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {credit}
              </span>
            ))}
          </div>
        </div>
        <div className="seg">
          {MODES.map((option) => (
            <button
              key={option}
              className={mode === option ? "on" : ""}
              onClick={() => {
                setMode(option);
                setRevealed(new Set());
              }}
            >
              {t(`modes.${option}`, tags)}
            </button>
          ))}
        </div>
        <label className="search" style={{ padding: "8px 12px" }}>
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchLine")}
            autoComplete="off"
            aria-label={t("searchLineLabel")}
          />
        </label>
      </div>
      <div className="txlines">
        <div className="hint" style={{ marginTop: 12 }}>
          <MarkerIcon width={20} height={20} style={{ flex: "none", color: "var(--cue-deep)" }} />
          <span>{t.rich("hint", { b: (chunks) => <b>{chunks}</b> })}</span>
        </div>
        {visibleLines.length === 0 ? (
          <p className="muted" style={{ padding: "24px 0" }}>
            {t("noLineWith", { query })}
          </p>
        ) : null}
        {visibleLines.map((line) => {
          const marked = new Set(marks[line.cueId] ?? []);
          const wholeLine = wholeLines.has(line.cueId);
          const translation =
            translations[line.cueId] ??
            (line.translation && line.translationSource
              ? { text: line.translation, source: line.translationSource }
              : null);
          const showTranslation = mode === "both" || (mode === "tap" && revealed.has(line.cueId));
          const isLoadingAudio = speech.loadingId === line.cueId;
          const hasAudio = cachedAudio.has(line.cueId) || speech.readyIds.has(line.cueId);
          const lineSuggestions = view.suggestions.filter(
            (suggestion) =>
              suggestion.cueId === line.cueId &&
              !Array.from(
                { length: suggestion.endToken - suggestion.startToken + 1 },
                (_, offset) => suggestion.startToken + offset,
              ).every((token) => marked.has(token)),
          );
          return (
            <div key={line.cueId}>
              {line.startsScene && !needle ? (
                <div className="scene">
                  {t("scene", { number: line.sceneIndex + 1 })} · {formatTimecode(line.startMs)}
                </div>
              ) : null}
              <div className={`tline ${wholeLine ? "mk" : ""}`} data-testid="line">
                <div className="tc">
                  {formatTimecode(line.startMs)}
                  <button
                    className="abtn"
                    onClick={() => speech.play("cue", line.cueId)}
                    aria-label={t("listenLine")}
                  >
                    {isLoadingAudio ? (
                      <>
                        <span className="spin" />
                        {t("generating")}
                      </>
                    ) : (
                      <>
                        <SoundIcon width={14} height={14} />
                        {hasAudio ? "" : t("listen")}
                      </>
                    )}
                  </button>
                  {line.markedByCount ? (
                    <span className="chip warn" style={{ padding: "1px 7px", fontSize: 11 }}>
                      {t("markedBy", { count: line.markedByCount })}
                    </span>
                  ) : null}
                </div>
                <div className="en">
                  {line.tokens.map((token, index) => (
                    <span key={index}>
                      <span
                        className={`w ${marked.has(index) ? "mk" : ""} ${needle && token.toLowerCase().includes(needle) ? "hit" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={marked.has(index)}
                        onClick={() => toggleWord(line.cueId, index)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleWord(line.cueId, index);
                          }
                        }}
                      >
                        {token}
                      </span>{" "}
                    </span>
                  ))}
                </div>
                <button
                  className={`mkbtn ${wholeLine ? "on" : ""}`}
                  onClick={() => toggleLine(line.cueId)}
                  aria-label={t("markLine")}
                  aria-pressed={wholeLine}
                >
                  <MarkerIcon />
                </button>
                {mode === "en" ? null : showTranslation && translation ? (
                  <div className="pt">
                    <span className="src">
                      {translation.source === "subtitle_pt" ? tags.native : t("ai")}
                    </span>
                    {translation.text}
                  </div>
                ) : translation ? (
                  <button
                    className="reveal"
                    onClick={() => setRevealed((current) => new Set(current).add(line.cueId))}
                  >
                    {t("showTranslation")}
                  </button>
                ) : (
                  <button
                    className="reveal"
                    onClick={() => translate(line.cueId)}
                    disabled={translatingId !== null}
                  >
                    {translatingId === line.cueId ? t("translating") : t("translateAi")}
                  </button>
                )}
                {lineSuggestions.length > 0 ? (
                  <div className="suggs">
                    {lineSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.startToken}-${suggestion.endToken}`}
                        className="sugg"
                        onClick={() =>
                          applySuggestion(line.cueId, suggestion.startToken, suggestion.endToken)
                        }
                        title={t("suggestionTitle")}
                      >
                        <SparkIcon />
                        {suggestion.term}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        <p className="small muted" style={{ marginTop: 16 }}>
          {t("audioNote", { count: view.lines.length })}
        </p>
      </div>
      <div className="txfoot">
        <div className="col" style={{ gap: 2 }}>
          <span className="count" data-testid="mark-count">
            {pendingCount}
          </span>
          <span className="small muted">{t("marks")}</span>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={generate} disabled={pendingCount === 0}>
          <SparkIcon width={18} height={18} /> {t("generateCards")}
        </button>
      </div>
    </div>
  );
}
