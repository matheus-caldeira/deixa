"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { importFromSourceAction, searchSubtitlesAction } from "@/app/actions/catalog";
import type { SourceImportView, SubtitleOptionView, SubtitleSearchView } from "@/app/actions/views";
import { LANGUAGE_TAGS, type LanguagePair, type StudyLanguage } from "@/shared/study-languages";
import { CheckIcon, SearchIcon } from "../icons";

type Role = "target" | "native";

function OptionChips({ option }: { option: SubtitleOptionView }) {
  const t = useTranslations("sources");
  const format = useFormatter();
  return (
    <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <span className="chip mono">{t("downloads", { count: format.number(option.downloads) })}</span>
      {option.hearingImpaired ? <span className="chip warn">{t("hearingImpaired")}</span> : null}
      {option.machineTranslated ? <span className="chip warn">{t("machineTranslated")}</span> : null}
      {option.uploader ? <span className="small muted">{t("by", { name: option.uploader })}</span> : null}
    </span>
  );
}

function Choice(props: {
  language: StudyLanguage;
  options: SubtitleOptionView[];
  chosen: SubtitleOptionView | null;
  locked: "source" | "manual" | null;
  optional: boolean;
  open: boolean;
  onToggle: () => void;
  onChoose: (fileId: string | null) => void;
}) {
  const t = useTranslations("sources");
  const languages = useTranslations("languages");
  const { language, chosen, locked } = props;
  const tag = LANGUAGE_TAGS[language];
  const name = languages(language);
  const canSwitch = !locked && (props.options.length > 1 || (props.optional && props.options.length > 0));
  const title = locked
    ? t("alreadyInCatalog", { name })
    : chosen
      ? chosen.release || t("subtitleIn", { name })
      : props.options.length === 0
        ? t("noneFound", { name })
        : t("without", { name });
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className={`slot ${chosen || locked ? "ok" : ""}`} style={{ cursor: "default" }}>
        <span className="ic">{chosen || locked ? <CheckIcon width={20} height={20} /> : tag}</span>
        <span className="col" style={{ gap: 4, minWidth: 0 }}>
          <b className="small" style={{ overflowWrap: "anywhere" }}>
            {tag} · {title}
          </b>
          {locked ? (
            <span className="small muted">{t("nothingDownloaded")}</span>
          ) : chosen ? (
            <OptionChips option={chosen} />
          ) : (
            <span className="small muted">{props.optional ? t("optionalAi") : t("uploadManually")}</span>
          )}
          {canSwitch ? (
            <button
              className="link small"
              style={{ alignSelf: "flex-start" }}
              onClick={props.onToggle}
              aria-expanded={props.open}
              aria-label={t("otherOptionsIn", { name })}
            >
              {props.open ? t("close") : t("otherOptions")}
            </button>
          ) : null}
        </span>
      </div>
      {props.open ? (
        <div className="col" style={{ gap: 8 }}>
          {props.options.map((option) => (
            <button
              key={option.fileId}
              className={`result ${chosen?.fileId === option.fileId ? "on" : ""}`}
              style={{ gridTemplateColumns: "1fr" }}
              onClick={() => props.onChoose(option.fileId)}
            >
              <span className="col" style={{ gap: 4, minWidth: 0, textAlign: "left" }}>
                <b className="small" style={{ overflowWrap: "anywhere" }}>
                  {option.release || t("noRelease")}
                </b>
                <OptionChips option={option} />
              </span>
            </button>
          ))}
          {props.optional ? (
            <button
              className={`result ${chosen ? "" : "on"}`}
              style={{ gridTemplateColumns: "1fr" }}
              onClick={() => props.onChoose(null)}
            >
              <b className="small">{t("doNotUse", { name })}</b>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SubtitleSourcePicker(props: {
  mediaId: string;
  episodeId: string;
  pair: LanguagePair;
  onImported: (view: SourceImportView) => void;
  onManual: () => void;
}) {
  const t = useTranslations("sources");
  const languages = useTranslations("languages");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState<SubtitleSearchView | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [nativeId, setNativeId] = useState<string | null>(null);
  const [open, setOpen] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const names = { target: languages(props.pair.target), native: languages(props.pair.native) };
  const tags = { target: LANGUAGE_TAGS[props.pair.target], native: LANGUAGE_TAGS[props.pair.native] };

  const runSearch = (refresh: boolean) =>
    startTransition(async () => {
      setError("");
      const result = await searchSubtitlesAction({ episodeId: props.episodeId, refresh });
      if (!result.ok) {
        setSearch(null);
        setError(result.message);
        return;
      }
      setSearch(result.data);
      setTargetId(result.data.existing.target ?? result.data.suggestion.targetFileId);
      setNativeId(result.data.existing.native ?? result.data.suggestion.nativeFileId);
      setOpen(null);
    });

  const manualLink = (
    <button className="link" style={{ alignSelf: "center" }} onClick={props.onManual}>
      {t("uploadSrt")}
    </button>
  );

  if (!search) {
    return (
      <>
        <div className="hint">
          <span>{t.rich("intro", { ...names, b: (chunks) => <b>{chunks}</b> })}</span>
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button
          className="btn wide"
          onClick={() => runSearch(false)}
          disabled={pending || props.episodeId === ""}
        >
          <SearchIcon width={18} height={18} /> {pending ? t("searching") : t("search")}
        </button>
        {manualLink}
      </>
    );
  }

  const lockedTarget = search.existing.hasTarget ? (search.existing.target ? "source" : "manual") : null;
  const lockedNative = search.existing.hasNative ? (search.existing.native ? "source" : "manual") : null;
  const target = search.target.find((option) => option.fileId === targetId) ?? null;
  const native = search.native.find((option) => option.fileId === nativeId) ?? null;
  const blockedByManual = lockedTarget === "manual" || lockedNative === "manual";
  const complete = Boolean(lockedTarget) && Boolean(lockedNative);
  const needed = (lockedTarget ? 0 : target ? 1 : 0) + (lockedNative ? 0 : native ? 1 : 0);
  const outOfQuota = search.quota !== null && needed > search.quota.remaining;
  const canImport = Boolean(targetId) && !blockedByManual && !complete && !outOfQuota && needed > 0;
  const samePair =
    target && native && search.suggestion.sameRelease
      ? target.fileId === search.suggestion.targetFileId && native.fileId === search.suggestion.nativeFileId
      : false;

  const confirm = () =>
    startTransition(async () => {
      if (!targetId) return;
      setError("");
      const result = await importFromSourceAction({
        mediaId: props.mediaId,
        episodeId: props.episodeId,
        targetFileId: targetId,
        nativeFileId: lockedNative === "manual" ? null : nativeId,
      });
      if (result.ok) props.onImported(result.data);
      else setError(result.message);
    });

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span className="eyebrow">{t("suggestion")}</span>
        {samePair ? <span className="chip good">{t("sameRelease", tags)}</span> : null}
      </div>
      {search.target.length === 0 && !lockedTarget ? (
        <div className="hint">{t("noTargetFound", names)}</div>
      ) : (
        <>
          <Choice
            language={props.pair.target}
            options={search.target}
            chosen={target}
            locked={lockedTarget}
            optional={false}
            open={open === "target"}
            onToggle={() => setOpen(open === "target" ? null : "target")}
            onChoose={(fileId) => {
              setTargetId(fileId);
              setOpen(null);
            }}
          />
          <Choice
            language={props.pair.native}
            options={search.native}
            chosen={native}
            locked={lockedNative}
            optional
            open={open === "native"}
            onToggle={() => setOpen(open === "native" ? null : "native")}
            onChoose={(fileId) => {
              setNativeId(fileId);
              setOpen(null);
            }}
          />
        </>
      )}
      <p className="small muted">
        {search.quota
          ? t("remaining", { count: search.quota.remaining }) +
            (search.quota.resetAt
              ? t("resetsAt", {
                  time: format.dateTime(new Date(search.quota.resetAt), {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })
              : "")
          : t("remainingUnknown")}
        {" · "}
        <button className="link small" onClick={() => runSearch(true)} disabled={pending}>
          {t("searchAgain")}
        </button>
      </p>
      {blockedByManual ? <div className="hint">{t("manualLocked")}</div> : null}
      {complete && !blockedByManual ? <div className="hint">{t("complete")}</div> : null}
      {outOfQuota ? <div className="hint">{t("outOfQuota")}</div> : null}
      {error ? <p className="formerr">{error}</p> : null}
      <button className="btn wide" onClick={confirm} disabled={!canImport || pending}>
        {pending ? t("downloading") : t("downloadAndProcess", { count: needed })}
      </button>
      {manualLink}
    </>
  );
}
