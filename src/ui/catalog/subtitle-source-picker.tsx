"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { importFromSourceAction, searchSubtitlesAction } from "@/app/actions/catalog";
import type { SourceImportView, SubtitleOptionView, SubtitleSearchView } from "@/app/actions/views";
import { CheckIcon, SearchIcon } from "../icons";

type Language = "en" | "pt-BR";
const LANGUAGE_TAG: Record<Language, string> = { en: "EN", "pt-BR": "PT" };

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
  language: Language;
  options: SubtitleOptionView[];
  chosen: SubtitleOptionView | null;
  locked: "source" | "manual" | null;
  optional: boolean;
  open: boolean;
  onToggle: () => void;
  onChoose: (fileId: string | null) => void;
}) {
  const t = useTranslations("sources");
  const { language, chosen, locked } = props;
  const tag = LANGUAGE_TAG[language];
  const name = t(`languages.${language}`);
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
            <button className={`result ${chosen ? "" : "on"}`} onClick={() => props.onChoose(null)}>
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
  onImported: (view: SourceImportView) => void;
  onManual: () => void;
}) {
  const t = useTranslations("sources");
  const format = useFormatter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState<SubtitleSearchView | null>(null);
  const [englishId, setEnglishId] = useState<string | null>(null);
  const [portugueseId, setPortugueseId] = useState<string | null>(null);
  const [open, setOpen] = useState<Language | null>(null);
  const [error, setError] = useState("");

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
      setEnglishId(result.data.existing.english ?? result.data.suggestion.englishFileId);
      setPortugueseId(result.data.existing.portuguese ?? result.data.suggestion.portugueseFileId);
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
          <span>{t.rich("intro", { b: (chunks) => <b>{chunks}</b> })}</span>
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

  const lockedEnglish = search.existing.hasEnglish ? (search.existing.english ? "source" : "manual") : null;
  const lockedPortuguese = search.existing.hasPortuguese
    ? search.existing.portuguese
      ? "source"
      : "manual"
    : null;
  const english = search.english.find((option) => option.fileId === englishId) ?? null;
  const portuguese = search.portuguese.find((option) => option.fileId === portugueseId) ?? null;
  const blockedByManual = lockedEnglish === "manual" || lockedPortuguese === "manual";
  const complete = Boolean(lockedEnglish) && Boolean(lockedPortuguese);
  const needed = (lockedEnglish ? 0 : english ? 1 : 0) + (lockedPortuguese ? 0 : portuguese ? 1 : 0);
  const outOfQuota = search.quota !== null && needed > search.quota.remaining;
  const canImport = Boolean(englishId) && !blockedByManual && !complete && !outOfQuota && needed > 0;
  const samePair =
    english && portuguese && search.suggestion.sameRelease
      ? english.fileId === search.suggestion.englishFileId &&
        portuguese.fileId === search.suggestion.portugueseFileId
      : false;

  const confirm = () =>
    startTransition(async () => {
      if (!englishId) return;
      setError("");
      const result = await importFromSourceAction({
        mediaId: props.mediaId,
        episodeId: props.episodeId,
        englishFileId: englishId,
        portugueseFileId: lockedPortuguese === "manual" ? null : portugueseId,
      });
      if (result.ok) props.onImported(result.data);
      else setError(result.message);
    });

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span className="eyebrow">{t("suggestion")}</span>
        {samePair ? <span className="chip good">{t("sameRelease")}</span> : null}
      </div>
      {search.english.length === 0 && !lockedEnglish ? (
        <div className="hint">{t("noTargetFound")}</div>
      ) : (
        <>
          <Choice
            language="en"
            options={search.english}
            chosen={english}
            locked={lockedEnglish}
            optional={false}
            open={open === "en"}
            onToggle={() => setOpen(open === "en" ? null : "en")}
            onChoose={(fileId) => {
              setEnglishId(fileId);
              setOpen(null);
            }}
          />
          <Choice
            language="pt-BR"
            options={search.portuguese}
            chosen={portuguese}
            locked={lockedPortuguese}
            optional
            open={open === "pt-BR"}
            onToggle={() => setOpen(open === "pt-BR" ? null : "pt-BR")}
            onChoose={(fileId) => {
              setPortugueseId(fileId);
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
