"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import {
  addLevelSourceAction,
  removeLevelSourceAction,
  setLevelSourceEnabledAction,
  syncLevelSourcesAction,
} from "@/app/actions/level-sources";
import type { LevelFetchFailure, LevelSourceStatus } from "@/modules/catalog";
import { APP_NAME } from "@/shared/app";

export type LevelSourceView = {
  id: string;
  url: string;
  name: string | null;
  parentId: string | null;
  enabled: boolean;
  status: LevelSourceStatus;
  ratingCount: number;
  rejectedCount: number;
  lastError: LevelFetchFailure | null;
  lastStatus: number | null;
  fetchedAt: string | null;
};

export type LevelSourcesView = { builtinCount: number; sources: LevelSourceView[] };

const FORMAT_EXAMPLE = JSON.stringify(
  { name: "…", ratings: { "tv:1668": "B1-B2", "movie:550": "C1" }, sources: ["https://…"] },
  null,
  2,
);
const POLL_MS = 3000;
const MAX_POLLS = 20;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

function SourceRow({ source, depth }: { source: LevelSourceView; depth: number }) {
  const t = useTranslations("levelSources");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const run = (work: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      setError("");
      const result = await work();
      if (!result.ok) setError(result.message ?? "");
      setConfirming(false);
      router.refresh();
    });

  const status =
    source.status === "PENDING"
      ? t("pending")
      : source.status === "FAILED"
        ? t(`failed.${source.lastError ?? "invalid"}`, { status: source.lastStatus ?? 0 })
        : t("ready", {
            count: source.ratingCount,
            date: source.fetchedAt ? format.dateTime(new Date(source.fetchedAt), { dateStyle: "short" }) : "",
          });

  return (
    <li className="col" style={{ gap: 6, paddingLeft: depth * 16, opacity: source.enabled ? 1 : 0.6 }}>
      <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{source.name ?? hostOf(source.url)}</strong>
        {source.enabled ? null : <span className="chip">{t("off")}</span>}
        {depth > 0 ? <span className="small muted">{t("listed")}</span> : null}
      </div>
      <span className="small mono muted" style={{ wordBreak: "break-all" }}>
        {source.url}
      </span>
      <span className={`small ${source.status === "FAILED" ? "formerr" : "muted"}`}>
        {status}
        {source.rejectedCount > 0 ? ` · ${t("rejected", { count: source.rejectedCount })}` : ""}
      </span>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn ghost sm"
          disabled={pending}
          onClick={() =>
            run(() => setLevelSourceEnabledAction({ sourceId: source.id, enabled: !source.enabled }))
          }
        >
          {source.enabled ? t("disable") : t("enable")}
        </button>
        {source.parentId === null && !confirming ? (
          <button
            type="button"
            className="btn ghost sm"
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            {t("remove")}
          </button>
        ) : null}
        {confirming ? (
          <>
            <button
              type="button"
              className="btn bad sm"
              disabled={pending}
              onClick={() => run(() => removeLevelSourceAction({ sourceId: source.id }))}
            >
              {t("confirmRemove")}
            </button>
            <button type="button" className="btn ghost sm" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </button>
          </>
        ) : null}
      </div>
      {error ? <p className="formerr">{error}</p> : null}
    </li>
  );
}

function SourceTree({
  view,
  parentId,
  depth,
}: {
  view: LevelSourcesView;
  parentId: string | null;
  depth: number;
}) {
  const children = view.sources.filter((source) => source.parentId === parentId);
  return children.flatMap((source) => [
    <SourceRow key={source.id} source={source} depth={depth} />,
    <SourceTree key={`${source.id}-children`} view={view} parentId={source.id} depth={depth + 1} />,
  ]);
}

export function LevelSourcesCard({ view }: { view: LevelSourcesView }) {
  const t = useTranslations("levelSources");
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const waiting = view.sources.some((source) => source.status === "PENDING");
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!waiting || polls >= MAX_POLLS) return;
    const timer = setTimeout(() => {
      setPolls((count) => count + 1);
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, polls, router]);

  const add = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      setError("");
      setNotice("");
      const result = await addLevelSourceAction({ url });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setUrl("");
      setPolls(0);
      setNotice(t("queued"));
      router.refresh();
    });
  };

  const syncAll = () =>
    startTransition(async () => {
      setError("");
      const result = await syncLevelSourcesAction();
      if (!result.ok) setError(result.message);
      else setNotice(t("queued"));
      setPolls(0);
      router.refresh();
    });

  return (
    <section className="card col" style={{ gap: 12 }} aria-labelledby="level-sources-title">
      <div className="col" style={{ gap: 4 }}>
        <h2 id="level-sources-title" style={{ fontSize: 17 }}>
          {t("title")}
        </h2>
        <p className="small muted">{t("intro")}</p>
      </div>
      <ul className="col" style={{ gap: 14, listStyle: "none", margin: 0, padding: 0 }}>
        <li className="col" style={{ gap: 2 }}>
          <strong style={{ fontSize: 14 }}>{t("builtin", { app: APP_NAME })}</strong>
          <span className="small muted">{t("builtinCount", { count: view.builtinCount })}</span>
        </li>
        <SourceTree view={view} parentId={null} depth={0} />
      </ul>
      {view.sources.length === 0 ? <p className="small muted">{t("empty")}</p> : null}
      <form className="col" style={{ gap: 8 }} onSubmit={add}>
        <div className="field">
          <label htmlFor="level-source-url">{t("urlLabel")}</label>
          <input
            id="level-source-url"
            className="mono"
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            required
          />
        </div>
        <p className="small muted">{t("format")}</p>
        <pre
          className="small mono muted"
          style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}
        >
          {FORMAT_EXAMPLE}
        </pre>
        {error ? <p className="formerr">{error}</p> : null}
        {notice && waiting ? <p className="small muted">{notice}</p> : null}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn" style={{ padding: 12, fontSize: 13 }} type="submit" disabled={pending}>
            {pending ? t("adding") : t("add")}
          </button>
          {view.sources.length > 0 ? (
            <button
              type="button"
              className="btn ghost"
              style={{ padding: 12, fontSize: 13 }}
              disabled={pending}
              onClick={syncAll}
            >
              {t("syncAll")}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
