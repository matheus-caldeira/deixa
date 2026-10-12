"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  acceptRecommendationAction,
  dismissRecommendationAction,
  refreshRecommendationsAction,
} from "@/app/actions/recommendations";
import type { LevelFit } from "@/shared/levels";
import { SparkIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { Poster, type PosterData } from "./poster";

export type SuggestionTile = {
  workKey: string;
  poster: PosterData;
  overview: string;
  genres: string[];
  reason: string;
  levelRange: string;
  fit: LevelFit;
};

export type SuggestionsView = {
  status: "ready" | "pending" | "failed" | "empty";
  insight: string | null;
  writtenByAi: boolean;
  updating: boolean;
  items: SuggestionTile[];
};

const FIT: Record<LevelFit, { label: string; className: string }> = {
  fit: { label: "No seu nível", className: "good" },
  challenging: { label: "Desafiador", className: "warn" },
  easy: { label: "Tranquilo", className: "" },
};
const POLL_MS = 4000;
const MAX_POLLS = 30;
const POLLS_AFTER_REQUEST = 2;

export function SuggestionsSection({ view }: { view: SuggestionsView }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);
  const [forcedPolls, setForcedPolls] = useState(0);
  const open = view.items.find((item) => item.workKey === openKey) ?? null;
  const waiting = polls < MAX_POLLS && (view.status === "pending" || view.updating || polls < forcedPolls);

  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setPolls((count) => count + 1);
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, polls, router]);

  const refresh = () =>
    startTransition(async () => {
      const result = await refreshRecommendationsAction();
      toast(result.ok ? "Atualizando suas sugestões…" : result.message);
      setPolls(0);
      setForcedPolls(POLLS_AFTER_REQUEST);
    });

  const accept = (item: SuggestionTile) =>
    startTransition(async () => {
      const result = await acceptRecommendationAction(item.workKey);
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setOpenKey(null);
      toast(`${item.poster.title} entrou no catálogo. Escolha um episódio e busque a legenda.`);
      router.push(`/catalog/${result.data.mediaId}`);
    });

  const dismiss = (item: SuggestionTile) =>
    startTransition(async () => {
      const result = await dismissRecommendationAction(item.workKey);
      setOpenKey(null);
      toast(result.ok ? "Certo, não sugerimos mais esse título." : result.message);
      router.refresh();
    });

  return (
    <section className="col" style={{ gap: 10 }} aria-label="Sugestões para você">
      <div className="sec-h">
        <h2 style={{ fontSize: 18 }}>Para você</h2>
        <button className="link small" onClick={refresh} disabled={pending || waiting}>
          {waiting && view.items.length > 0 ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      {view.insight ? <p className="note">{view.insight}</p> : null}
      {view.items.length > 0 ? (
        <div className="hscroll">
          {view.items.map((item) => (
            <button
              key={item.workKey}
              className="cont card sug"
              style={{ padding: 10 }}
              onClick={() => setOpenKey(item.workKey)}
              aria-label={`Sugestão: ${item.poster.title}`}
            >
              <Poster media={item.poster} sizes="64px" />
              <span className="col" style={{ gap: 4, minWidth: 0 }}>
                <b className="small">{item.poster.title}</b>
                <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                  <span className={`chip ${FIT[item.fit].className}`}>{FIT[item.fit].label}</span>
                  <span className="chip mono">{item.levelRange}</span>
                </span>
                <span className="small muted why">{item.reason}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">
          {view.status === "pending"
            ? "Montando suas sugestões a partir do que você estudou…"
            : view.status === "failed"
              ? "Não deu para montar as sugestões agora. Toque em Atualizar para tentar de novo."
              : "Sem sugestões novas por enquanto. Elas mudam conforme você estuda."}
        </p>
      )}
      {view.items.length > 0 ? (
        <p className="small muted">
          {view.writtenByAi
            ? "Escolhidas por semelhança com o que você estudou e explicadas pela IA. O nível é uma estimativa."
            : "Escolhidas por semelhança com o que você estudou. Quando a IA está disponível, cada sugestão vem explicada. O nível é uma estimativa."}
        </p>
      ) : null}
      {open ? (
        <Sheet label="Sugestão para você" onClose={() => setOpenKey(null)}>
          <div className="dhead">
            <Poster media={open.poster} sizes="110px" />
            <div className="col" style={{ gap: 8, minWidth: 0 }}>
              <h2 style={{ fontSize: 22, lineHeight: 1.1 }}>{open.poster.title}</h2>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                <span className={`chip ${FIT[open.fit].className}`}>{FIT[open.fit].label}</span>
                <span className="chip mono">{open.levelRange} estimado</span>
                {open.genres.slice(0, 3).map((genre) => (
                  <span className="chip" key={genre}>
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="hint">
            <SparkIcon />
            <span>
              <b>Por que para você.</b> {open.reason}
            </span>
          </div>
          <p className="muted">{open.overview}</p>
          <button className="btn cue wide" onClick={() => accept(open)} disabled={pending}>
            Adicionar ao catálogo
          </button>
          <button className="btn ghost wide" onClick={() => dismiss(open)} disabled={pending}>
            Não tenho interesse
          </button>
          <p className="small muted">
            Adicionar só cadastra a obra. A legenda é buscada quando você escolher um episódio.
          </p>
        </Sheet>
      ) : null}
    </section>
  );
}
