"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { importPackageAction } from "@/app/actions/transfer";
import {
  downloadPackage,
  exportPersonal,
  inspectPackage,
  PERSONAL_EXPORT_ACTION,
} from "@/ui/transfer/transfer-client";
import type { ImportReport, PackagePreview } from "@/modules/packages";
import { CheckIcon } from "../icons";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";

export type TransferWork = {
  id: string;
  title: string;
  type: "series" | "movie";
  seasons: {
    seasonNumber: number;
    episodes: { id: string; episodeNumber: number; title: string; ready: boolean }[];
  }[];
};

export type TransferView = { works: TransferWork[]; selectedMediaId: string | null; passwordError: boolean };

type ExportScope = "me" | "work" | "season" | "episode";
type ImportStage =
  { step: "pick" } | { step: "preview"; preview: PackagePreview } | { step: "done"; report: ImportReport };

const SCOPES: ExportScope[] = ["me", "work", "season", "episode"];

function Pick({
  on,
  title,
  detail,
  onToggle,
}: {
  on: boolean;
  title: string;
  detail: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`result ${on ? "on" : ""}`}
      style={{ gridTemplateColumns: "1fr 22px" }}
      onClick={onToggle}
      aria-pressed={on}
    >
      <span className="col" style={{ gap: 2, minWidth: 0 }}>
        <b>{title}</b>
        <span className="small muted">{detail}</span>
      </span>
      <span style={{ width: 22, height: 22, color: "var(--brand)" }}>{on ? <CheckIcon /> : null}</span>
    </button>
  );
}

function ExportCard({ view }: { view: TransferView }) {
  const router = useRouter();
  const t = useTranslations("transfer");
  const [scope, setScope] = useState<ExportScope>(view.selectedMediaId ? "work" : "me");
  const [includeKeys, setIncludeKeys] = useState(false);
  const [mediaId, setMediaId] = useState(view.selectedMediaId ?? view.works[0]?.id ?? "");
  const work = view.works.find((candidate) => candidate.id === mediaId) ?? null;
  const [seasonNumber, setSeasonNumber] = useState<number>(work?.seasons[0]?.seasonNumber ?? 0);
  const season =
    work?.seasons.find((candidate) => candidate.seasonNumber === seasonNumber) ?? work?.seasons[0] ?? null;
  const [episodeId, setEpisodeId] = useState(season?.episodes[0]?.id ?? "");
  const [options, setOptions] = useState({ subtitles: true, cards: true, audio: false });
  const toggle = (key: keyof typeof options) =>
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  const params = new URLSearchParams({ kind: scope, mediaId });
  if (scope === "season") params.set("seasonNumber", String(season?.seasonNumber ?? 0));
  if (scope === "episode") params.set("episodeId", episodeId || (season?.episodes[0]?.id ?? ""));
  for (const [key, on] of Object.entries(options)) if (on) params.set(key, "1");
  const ready = Boolean(work) && (scope !== "episode" || Boolean(params.get("episodeId")));

  const personal = (
    <form
      className="col"
      style={{ gap: 14 }}
      method="post"
      action={PERSONAL_EXPORT_ACTION}
      onSubmit={(event) => {
        if (PERSONAL_EXPORT_ACTION) return;
        event.preventDefault();
        const form = event.currentTarget;
        void exportPersonal(form).then((outcome) => {
          if (outcome === "wrongPassword") router.push("/transfer?erro=senha");
        });
      }}
    >
      <p className="small muted">{t("personalIntro")}</p>
      <div className="field">
        <label>{t("apiKeys")}</label>
        <div className="seg" role="radiogroup" aria-label={t("apiKeys")}>
          <button type="button" className={includeKeys ? "" : "on"} onClick={() => setIncludeKeys(false)}>
            {t("withoutKeys")}
          </button>
          <button type="button" className={includeKeys ? "on" : ""} onClick={() => setIncludeKeys(true)}>
            {t("withKeys")}
          </button>
        </div>
        <span className="small muted">{t("withKeysNote")}</span>
      </div>
      <input type="hidden" name="includeCredentials" value={includeKeys ? "true" : "false"} />
      <div className="field">
        <label htmlFor="export-password">{t("yourPassword")}</label>
        <input
          id="export-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <span className="small muted">{t("passwordNote")}</span>
      </div>
      {view.passwordError ? <p className="formerr">{t("wrongPassword")}</p> : null}
      <button className="btn block" type="submit">
        {t("exportZip")}
      </button>
    </form>
  );

  return (
    <section className="card col" style={{ gap: 14 }} id="exportar">
      <h2 style={{ fontSize: 17 }}>{t("export")}</h2>
      <div className="seg" role="radiogroup" aria-label={t("exportScope")}>
        {SCOPES.map((option) => (
          <button
            key={option}
            type="button"
            className={scope === option ? "on" : ""}
            onClick={() => setScope(option)}
            disabled={(option === "season" || option === "episode") && (!work || work.type === "movie")}
          >
            {t(`scopes.${option}`)}
          </button>
        ))}
      </div>
      {scope === "me" ? (
        personal
      ) : view.works.length === 0 ? (
        <p className="small muted">{t("emptyCatalog")}</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="export-work">{t("work")}</label>
            <select
              id="export-work"
              value={mediaId}
              onChange={(event) => {
                setMediaId(event.target.value);
                const next = view.works.find((candidate) => candidate.id === event.target.value);
                setSeasonNumber(next?.seasons[0]?.seasonNumber ?? 0);
                setEpisodeId(next?.seasons[0]?.episodes[0]?.id ?? "");
              }}
            >
              {view.works.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </div>
          {scope !== "work" && work ? (
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="export-season">{t("season")}</label>
                <select
                  id="export-season"
                  value={season?.seasonNumber ?? 0}
                  onChange={(event) => {
                    const number = Number(event.target.value);
                    setSeasonNumber(number);
                    const next = work.seasons.find((candidate) => candidate.seasonNumber === number);
                    setEpisodeId(next?.episodes[0]?.id ?? "");
                  }}
                >
                  {work.seasons.map((candidate) => (
                    <option key={candidate.seasonNumber} value={candidate.seasonNumber}>
                      {candidate.seasonNumber}
                    </option>
                  ))}
                </select>
              </div>
              {scope === "episode" && season ? (
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="export-episode">{t("episode")}</label>
                  <select
                    id="export-episode"
                    value={episodeId}
                    onChange={(event) => setEpisodeId(event.target.value)}
                  >
                    {season.episodes.map((episode) => (
                      <option key={episode.id} value={episode.id}>
                        {episode.episodeNumber}
                        {episode.ready ? "" : ` ${t("noSubtitle")}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="col" style={{ gap: 8 }}>
            <span className="eyebrow">{t("contents")}</span>
            <Pick
              on={options.subtitles}
              title={t("subtitles")}
              detail={t("subtitlesDetail")}
              onToggle={() => toggle("subtitles")}
            />
            <Pick
              on={options.cards}
              title={t("catalogCards")}
              detail={t("catalogCardsDetail")}
              onToggle={() => toggle("cards")}
            />
            <Pick
              on={options.audio}
              title={t("audio")}
              detail={t("audioDetail")}
              onToggle={() => toggle("audio")}
            />
          </div>
          <p className="note">{t("rightsNote")}</p>
          <button
            type="button"
            className={`btn block ${ready ? "" : "disabled"}`}
            disabled={!ready}
            onClick={() => downloadPackage(params)}
          >
            {t("exportZip")}
          </button>
        </>
      )}
    </section>
  );
}

function ImportCard() {
  const t = useTranslations("transfer");
  const errorText = useErrorText();
  const format = useFormatter();
  const router = useRouter();
  const toast = useToast();
  const [stage, setStage] = useState<ImportStage>({ step: "pick" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const inspect = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = await inspectPackage(file);
      if (!body.ok) {
        setError(body.message);
        return;
      }
      setStage({ step: "preview", preview: body.data });
    } catch {
      setError(errorText(null));
    } finally {
      setBusy(false);
    }
  };

  const confirm = (preview: PackagePreview) =>
    startTransition(async () => {
      setBusy(true);
      setError("");
      const result = await importPackageAction({
        uploadId: preview.uploadId,
        password: preview.personal && password.trim() !== "" ? password : undefined,
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStage({ step: "done", report: result.data });
      toast(t("importDone"));
      router.refresh();
    });

  return (
    <section className="card col" style={{ gap: 14 }} id="importar">
      <h2 style={{ fontSize: 17 }}>{t("import")}</h2>
      {stage.step === "pick" ? (
        <label className="slot">
          <span className="ic">ZIP</span>
          <span className="col" style={{ gap: 2 }}>
            <b>{busy ? t("reading") : t("chooseZip")}</b>
            <span className="small muted">{t("chooseNote")}</span>
          </span>
          <input
            type="file"
            accept=".zip,application/zip"
            style={{ display: "none" }}
            disabled={busy}
            onChange={(event) => void inspect(event.target.files?.[0])}
            aria-label={t("packageFile")}
          />
        </label>
      ) : null}
      {stage.step === "preview" ? (
        <>
          <dl className="kv">
            <dt>{t("origin")}</dt>
            <dd>
              {stage.preview.app} ·{" "}
              {format.dateTime(new Date(stage.preview.generatedAt), { dateStyle: "short" })}
            </dd>
          </dl>
          <div>
            <span className="eyebrow">{t("willEnter")}</span>
            {stage.preview.works.map((work) => (
              <div key={work.title}>
                <div className="dueitem">
                  <span className="col" style={{ gap: 2 }}>
                    <b>{work.title}</b>
                    <span className="small muted">
                      {work.status === "new" ? t("newWork") : t("existingWork")}
                    </span>
                  </span>
                </div>
                {work.episodes.map((episode) => (
                  <div key={episode.label} className="dueitem">
                    <span className="col" style={{ gap: 2 }}>
                      <span>
                        {episode.label} · {episode.title}
                      </span>
                      <span className="small muted">
                        {episode.subtitles > 0
                          ? t("subtitleCount", { count: episode.subtitles })
                          : t("noSubtitleLower")}
                        {episode.cards > 0 ? ` · ${t("cardCount", { count: episode.cards })}` : ""}
                      </span>
                    </span>
                    <span
                      className={`chip ${episode.status === "new" ? "good" : ""}`}
                      style={{ alignSelf: "start" }}
                    >
                      {episode.status === "new" ? t("new") : t("exists")}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {stage.preview.audio > 0 ? (
              <div className="dueitem">
                <span>{t("audio")}</span>
                <b>{stage.preview.audio}</b>
              </div>
            ) : null}
            {stage.preview.personal ? (
              <div className="dueitem">
                <span className="col" style={{ gap: 2 }}>
                  <b>{t("personalData")}</b>
                  <span className="small muted">
                    {t(stage.preview.personal.includesCredentials ? "personalFromWithKeys" : "personalFrom", {
                      email: stage.preview.personal.email,
                    })}
                  </span>
                </span>
                <span className="chip warn" style={{ alignSelf: "start" }}>
                  {t("needsPassword")}
                </span>
              </div>
            ) : null}
          </div>
          {stage.preview.personal ? (
            <div className="field">
              <label htmlFor="import-password">
                {t("passwordOf", { email: stage.preview.personal.email })}
              </label>
              <input
                id="import-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span className="small muted">{t("withoutPasswordNote")}</span>
            </div>
          ) : null}
          <div className="row">
            <button
              className="btn ghost"
              style={{ padding: "12px 14px", fontSize: 13 }}
              onClick={() => setStage({ step: "pick" })}
              disabled={busy}
            >
              {t("cancel")}
            </button>
            <button
              className="btn"
              style={{ padding: "12px 14px", fontSize: 13, flex: 1 }}
              onClick={() => confirm(stage.preview)}
              disabled={busy}
            >
              {busy ? t("importing") : t("import")}
            </button>
          </div>
        </>
      ) : null}
      {stage.step === "done" ? (
        <>
          <div className="row">
            <span style={{ width: 28, height: 28, color: "var(--good)", flex: "none" }}>
              <CheckIcon />
            </span>
            <b>{t("importDone")}</b>
          </div>
          <div>
            <div className="dueitem">
              <span>{t("newWorks")}</span>
              <b>{stage.report.worksCreated}</b>
            </div>
            <div className="dueitem">
              <span>{t("episodesImported")}</span>
              <b>{stage.report.episodesImported}</b>
            </div>
            <div className="dueitem">
              <span>{t("cardsSuggested")}</span>
              <b>{stage.report.cards}</b>
            </div>
            <div className="dueitem">
              <span>{t("audio")}</span>
              <b>{stage.report.audio}</b>
            </div>
            <div className="dueitem">
              <span className="muted">{t("episodesSkipped")}</span>
              <b className="muted">{stage.report.episodesSkipped}</b>
            </div>
            {stage.report.personal ? (
              <div className="dueitem">
                <span className="col" style={{ gap: 2 }}>
                  <span>{t("personalData")}</span>
                  <span className="small muted">
                    {t("personalSummary", {
                      cards: stage.report.personal.cards,
                      highlights: stage.report.personal.highlights,
                      progress: stage.report.personal.progress,
                      xp: stage.report.personal.xp,
                    })}
                    {stage.report.personal.seriesEpisodes > 0
                      ? `, ${t("seriesEpisodes", { count: stage.report.personal.seriesEpisodes })}`
                      : ""}
                    {stage.report.personal.credentials > 0
                      ? `, ${t("keyCount", { count: stage.report.personal.credentials })}`
                      : ""}
                    {stage.report.personal.skipped > 0
                      ? `; ${t("skippedItems", { count: stage.report.personal.skipped })}`
                      : ""}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
          {stage.report.warnings.length > 0 ? (
            <ul className="small muted" style={{ paddingLeft: 18 }}>
              {stage.report.warnings.map((warning) => (
                <li key={`${warning.key}:${warning.label}`}>
                  {t(`warnings.${warning.key}`, { label: warning.label })}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            className="btn ghost"
            style={{ padding: 10, fontSize: 13 }}
            onClick={() => setStage({ step: "pick" })}
          >
            {t("importAnother")}
          </button>
        </>
      ) : null}
      {error ? <p className="formerr">{error}</p> : null}
      <p className="small muted">{t("idempotentNote")}</p>
    </section>
  );
}

export function TransferScreen({ view }: { view: TransferView }) {
  const t = useTranslations("transfer");
  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>{t("title")}</h1>
      <p className="muted">{t("intro")}</p>
      <div className="col" style={{ gap: 18, maxWidth: 640, width: "100%" }}>
        <ImportCard />
        <ExportCard view={view} />
      </div>
    </>
  );
}
