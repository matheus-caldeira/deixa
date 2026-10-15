"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { FIT_CLASS } from "./catalog-screen";
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

const POLL_MS = 4000;
const MAX_POLLS = 30;
const POLLS_AFTER_REQUEST = 2;

export function SuggestionsSection({ view }: { view: SuggestionsView }) {
  const t = useTranslations("suggestions");
  const fits = useTranslations("fit");
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
      toast(result.ok ? t("refreshing") : result.message);
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
      toast(t("added", { title: item.poster.title }));
      router.push(`/catalog/${result.data.mediaId}`);
    });

  const dismiss = (item: SuggestionTile) =>
    startTransition(async () => {
      const result = await dismissRecommendationAction(item.workKey);
      setOpenKey(null);
      toast(result.ok ? t("dismissed") : result.message);
      router.refresh();
    });

  return (
    <section className="col" style={{ gap: 10 }} aria-label={t("label")}>
      <div className="sec-h">
        <h2 style={{ fontSize: 18 }}>{t("title")}</h2>
        <button className="link small" onClick={refresh} disabled={pending || waiting}>
          {waiting && view.items.length > 0 ? t("updating") : t("update")}
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
              aria-label={t("suggestion", { title: item.poster.title })}
            >
              <Poster media={item.poster} sizes="64px" />
              <span className="col" style={{ gap: 4, minWidth: 0 }}>
                <b className="small">{item.poster.title}</b>
                <span className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                  <span className={`chip ${FIT_CLASS[item.fit]}`}>{fits(item.fit)}</span>
                  <span className="chip mono">{item.levelRange}</span>
                </span>
                <span className="small muted why">{item.reason}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">
          {view.status === "pending" ? t("pending") : view.status === "failed" ? t("failed") : t("empty")}
        </p>
      )}
      {view.items.length > 0 ? (
        <p className="small muted">{view.writtenByAi ? t("explainedByAi") : t("notExplained")}</p>
      ) : null}
      {open ? (
        <Sheet label={t("sheet")} onClose={() => setOpenKey(null)}>
          <div className="dhead">
            <Poster media={open.poster} sizes="110px" />
            <div className="col" style={{ gap: 8, minWidth: 0 }}>
              <h2 style={{ fontSize: 22, lineHeight: 1.1 }}>{open.poster.title}</h2>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                <span className={`chip ${FIT_CLASS[open.fit]}`}>{fits(open.fit)}</span>
                <span className="chip mono">{t("estimated", { range: open.levelRange })}</span>
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
              <b>{t("why")}</b> {open.reason}
            </span>
          </div>
          <p className="muted">{open.overview}</p>
          <button className="btn cue wide" onClick={() => accept(open)} disabled={pending}>
            {t("add")}
          </button>
          <button className="btn ghost wide" onClick={() => dismiss(open)} disabled={pending}>
            {t("notInterested")}
          </button>
          <p className="small muted">{t("addNote")}</p>
        </Sheet>
      ) : null}
    </section>
  );
}
