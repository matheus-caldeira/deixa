"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  confirmCardsAction,
  generateCardsAction,
  syncHighlightsAction,
  translateCueAction,
  type GeneratedCardsView,
  type SavedHighlightView,
} from "@/app/actions/reading";
import { tokenRuns } from "@/modules/highlights";
import { ITEM_TYPE_LABELS } from "@/modules/learning";
import type { DisplayMode } from "@/shared/levels";
import { formatTimecode } from "@/shared/time";
import { BackIcon, CheckIcon, MarkerIcon, SearchIcon, SoundIcon, SparkIcon, XIcon } from "../icons";
import { useToast } from "../shell/toast";
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
  hasPortuguese: boolean;
  defaultMode: DisplayMode;
  audioSpeed: number;
  lines: ReadLine[];
  highlights: SavedHighlightView[];
  suggestions: { cueId: string; startToken: number; endToken: number; term: string }[];
  cachedAudioCueIds: string[];
};

const MODES: { key: DisplayMode; label: string }[] = [
  { key: "both", label: "EN + PT" },
  { key: "tap", label: "PT ao tocar" },
  { key: "en", label: "Só inglês" },
];
const GENERATION_STEPS = [
  "Agrupando marcações vizinhas em expressões",
  "Pegando a tradução das falas na legenda PT",
  "Explicando cada termo no contexto da cena",
  "Validando a saída",
  "Montando os cards",
];
const SYNC_DELAY_MS = 700;
const STEP_MS = 450;

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
  const [stage, setStage] = useState<Stage>("read");
  const [step, setStep] = useState(0);
  const [generated, setGenerated] = useState<GeneratedCardsView | null>(null);
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
    setRemoved(new Set());
    window.scrollTo(0, 0);
    startTransition(async () => {
      const result = await generateCardsAction(payload());
      if (!result.ok) {
        toast(result.message);
        setStage("read");
        return;
      }
      setGenerated(result.data);
    });
  };

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
    startTransition(async () => {
      const result = await confirmCardsAction({
        batchId: generated.batchId,
        keepKeys: keptDrafts.map((draft) => draft.key),
        scope,
      });
      setSaving(false);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      toast(
        `${result.data.cardsKept} cards na sua revisão${scope === "catalog" ? " e sugeridos no catálogo" : ""} · +${result.data.xpAwarded} XP`,
      );
      router.push("/review");
      router.refresh();
    });
  };

  const generationFinished = stage === "generating" && generated !== null && step >= GENERATION_STEPS.length;

  if (stage === "generating" && !generationFinished) {
    const steps = generated?.steps ?? GENERATION_STEPS.map((label) => ({ label, detail: "" }));
    return (
      <div className="tx">
        <div className="done" style={{ justifyContent: "flex-start", paddingTop: 48 }}>
          <div style={{ width: 64, height: 64, color: "var(--brand)" }}>
            <SparkIcon />
          </div>
          <h1 style={{ fontSize: 26 }}>Criando seus cards</h1>
          <div className="col" style={{ gap: 14, width: "100%", textAlign: "left" }}>
            {steps.map((entry, index) => {
              const state = index < step ? "done" : index === step ? "run" : "wait";
              return (
                <div key={entry.label} className={`pstep ${state}`}>
                  <span className="s">{state === "done" ? <CheckIcon /> : null}</span>
                  <span>{entry.label}</span>
                  <span className="small muted mono">{state === "done" ? entry.detail : ""}</span>
                </div>
              );
            })}
          </div>
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
            <button className="iconbtn" onClick={() => setStage("read")} aria-label="Voltar para a legenda">
              <BackIcon />
            </button>
            <div className="col" style={{ gap: 0, flex: 1 }}>
              <b>Cards do episódio</b>
              <span className="small muted">
                {view.mediaTitle} · {view.label}
              </span>
            </div>
            <span className="chip mono">{keptDrafts.length} cards</span>
          </div>
          <div className="seg">
            <button className={scope === "private" ? "on" : ""} onClick={() => setScope("private")}>
              Só para mim
            </button>
            <button className={scope === "catalog" ? "on" : ""} onClick={() => setScope("catalog")}>
              Para o catálogo
            </button>
          </div>
          <p className="small muted">
            {scope === "private"
              ? "Os cards vão só para a sua revisão. Ninguém vê o que você marcou."
              : 'Os cards também viram sugestões para quem estudar este episódio. Suas marcações entram numa contagem anônima ("marcada por N alunos").'}
          </p>
        </div>
        <div className="txlines" style={{ gap: 12, paddingTop: 14 }}>
          {allFromSubtitle ? (
            <div className="hint" style={{ background: "var(--good-soft)" }}>
              <span>
                <b style={{ color: "var(--good)" }}>Tradução das falas veio da legenda PT</b>, sem custo de
                IA. A IA só explicou o significado de cada termo.
              </span>
            </div>
          ) : null}
          {generated.simulated ? (
            <div className="hint">
              <span>
                <b>Explicações simuladas.</b> Adicione sua chave do Google AI no perfil para explicações de
                verdade.
              </span>
            </div>
          ) : null}
          {keptDrafts.length === 0 ? <p className="muted">Você removeu todos os cards.</p> : null}
          {keptDrafts.map((draft) => {
            const lineTokens = draft.lineText.split(/\s+/);
            const fromSubtitle = draft.lineTranslationSource === "subtitle_pt";
            return (
              <div className="gcard" key={draft.key}>
                <div className="col" style={{ gap: 6, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="chip">{ITEM_TYPE_LABELS[draft.itemType]}</span>
                    <span className="small muted mono">{formatTimecode(draft.startMs)}</span>
                  </div>
                  <div className="term">{draft.term}</div>
                  <div
                    className="small"
                    style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}
                  >
                    <span className={`srcb ${draft.meaningSource === "subtitle_pt" ? "pt" : "ai"}`}>
                      {draft.meaningSource === "subtitle_pt" ? "legenda PT" : "IA"}
                    </span>
                    <span>{draft.meaning}</span>
                  </div>
                </div>
                <button
                  className="iconbtn"
                  onClick={() => setRemoved((current) => new Set(current).add(draft.key))}
                  aria-label={`Remover card ${draft.term}`}
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
                          {fromSubtitle ? "PT" : "IA"}
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
            {saving ? "Salvando…" : `Adicionar ${keptDrafts.length} cards à revisão`}
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
          <Link className="iconbtn" href={view.backHref} aria-label="Voltar">
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
              {view.episodeTitle} · legenda {view.hasPortuguese ? "EN + PT alinhada" : "EN, tradução por IA"}
            </span>
          </div>
        </div>
        <div className="seg">
          {MODES.map((option) => (
            <button
              key={option.key}
              className={mode === option.key ? "on" : ""}
              onClick={() => {
                setMode(option.key);
                setRevealed(new Set());
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="search" style={{ padding: "8px 12px" }}>
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Procurar uma fala que você ouviu"
            autoComplete="off"
            aria-label="Procurar uma fala"
          />
        </label>
      </div>
      <div className="txlines">
        <div className="hint" style={{ marginTop: 12 }}>
          <MarkerIcon width={20} height={20} style={{ flex: "none", color: "var(--cue-deep)" }} />
          <span>
            Toque nas <b>palavras</b> que você não conhece. Palavras vizinhas viram uma expressão. Use o
            marcador ao lado para salvar a <b>fala inteira</b>.
          </span>
        </div>
        {visibleLines.length === 0 ? (
          <p className="muted" style={{ padding: "24px 0" }}>
            Nenhuma fala com &quot;{query}&quot;.
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
                  CENA {line.sceneIndex + 1} · {formatTimecode(line.startMs)}
                </div>
              ) : null}
              <div className={`tline ${wholeLine ? "mk" : ""}`} data-testid="line">
                <div className="tc">
                  {formatTimecode(line.startMs)}
                  <button
                    className="abtn"
                    onClick={() => speech.play("cue", line.cueId)}
                    aria-label="Ouvir a fala"
                  >
                    {isLoadingAudio ? (
                      <>
                        <span className="spin" />
                        gerando…
                      </>
                    ) : (
                      <>
                        <SoundIcon width={14} height={14} />
                        {hasAudio ? "" : "ouvir"}
                      </>
                    )}
                  </button>
                  {line.markedByCount ? (
                    <span className="chip warn" style={{ padding: "1px 7px", fontSize: 11 }}>
                      marcada por {line.markedByCount} alunos
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
                  aria-label="Marcar a fala inteira"
                  aria-pressed={wholeLine}
                >
                  <MarkerIcon />
                </button>
                {mode === "en" ? null : showTranslation && translation ? (
                  <div className="pt">
                    <span className="src">{translation.source === "subtitle_pt" ? "PT" : "IA"}</span>
                    {translation.text}
                  </div>
                ) : translation ? (
                  <button
                    className="reveal"
                    onClick={() => setRevealed((current) => new Set(current).add(line.cueId))}
                  >
                    ver tradução
                  </button>
                ) : (
                  <button
                    className="reveal"
                    onClick={() => translate(line.cueId)}
                    disabled={translatingId !== null}
                  >
                    {translatingId === line.cueId ? "traduzindo…" : "traduzir com IA"}
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
                        title="Sugestão de quem já estudou este episódio"
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
          {view.lines.length} falas. O áudio de cada fala só é gerado na primeira vez que alguém toca em
          &quot;ouvir&quot; e depois fica salvo para todos.
        </p>
      </div>
      <div className="txfoot">
        <div className="col" style={{ gap: 2 }}>
          <span className="count" data-testid="mark-count">
            {pendingCount}
          </span>
          <span className="small muted">marcações</span>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={generate} disabled={pendingCount === 0}>
          <SparkIcon width={18} height={18} /> Gerar cards
        </button>
      </div>
    </div>
  );
}
