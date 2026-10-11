"use client";

import { useState, useTransition } from "react";
import { importFromSourceAction, searchSubtitlesAction } from "@/app/actions/catalog";
import type { SourceImportView, SubtitleOptionView, SubtitleSearchView } from "@/app/actions/views";
import { CheckIcon, SearchIcon } from "../icons";

type Language = "en" | "pt-BR";
const LANGUAGE_TAG: Record<Language, string> = { en: "EN", "pt-BR": "PT" };
const LANGUAGE_NAME: Record<Language, string> = { en: "inglês", "pt-BR": "português" };

const count = (value: number): string => value.toLocaleString("pt-BR");

function resetLabel(resetAt: string | null): string {
  if (!resetAt) return "";
  const time = new Date(resetAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return ` · renova às ${time}`;
}

function OptionChips({ option }: { option: SubtitleOptionView }) {
  return (
    <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <span className="chip mono">{count(option.downloads)} downloads</span>
      {option.hearingImpaired ? <span className="chip warn">Com descrição de sons</span> : null}
      {option.machineTranslated ? <span className="chip warn">Tradução automática</span> : null}
      {option.uploader ? <span className="small muted">por {option.uploader}</span> : null}
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
  const { language, chosen, locked } = props;
  const tag = LANGUAGE_TAG[language];
  const canSwitch = !locked && (props.options.length > 1 || (props.optional && props.options.length > 0));
  const title = locked
    ? `Legenda em ${LANGUAGE_NAME[language]} já no catálogo`
    : chosen
      ? chosen.release || `Legenda em ${LANGUAGE_NAME[language]}`
      : props.options.length === 0
        ? `Nenhuma legenda em ${LANGUAGE_NAME[language]} encontrada`
        : `Sem legenda em ${LANGUAGE_NAME[language]}`;
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className={`slot ${chosen || locked ? "ok" : ""}`} style={{ cursor: "default" }}>
        <span className="ic">{chosen || locked ? <CheckIcon width={20} height={20} /> : tag}</span>
        <span className="col" style={{ gap: 4, minWidth: 0 }}>
          <b className="small" style={{ overflowWrap: "anywhere" }}>
            {tag} · {title}
          </b>
          {locked ? (
            <span className="small muted">Nada será baixado de novo para este idioma.</span>
          ) : chosen ? (
            <OptionChips option={chosen} />
          ) : (
            <span className="small muted">
              {props.optional
                ? "Opcional: sem ela, a tradução das falas vem da IA."
                : "Envie o arquivo manualmente."}
            </span>
          )}
        </span>
        {canSwitch ? (
          <button
            className="link small"
            onClick={props.onToggle}
            aria-expanded={props.open}
            aria-label={`Ver outras opções em ${LANGUAGE_NAME[language]}`}
          >
            {props.open ? "Fechar" : "Ver outras opções"}
          </button>
        ) : null}
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
                  {option.release || "Sem nome de release"}
                </b>
                <OptionChips option={option} />
              </span>
            </button>
          ))}
          {props.optional ? (
            <button className={`result ${chosen ? "" : "on"}`} onClick={() => props.onChoose(null)}>
              <b className="small">Não usar legenda em {LANGUAGE_NAME[language]}</b>
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
      Enviar arquivos .srt manualmente
    </button>
  );

  if (!search) {
    return (
      <>
        <div className="hint">
          Buscamos no <b>OpenSubtitles</b> as legendas em inglês e português deste episódio. Nada é baixado
          até você confirmar a escolha.
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button
          className="btn wide"
          onClick={() => runSearch(false)}
          disabled={pending || props.episodeId === ""}
        >
          <SearchIcon /> {pending ? "Buscando…" : "Buscar legendas"}
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
        <span className="eyebrow">Sugestão do OpenSubtitles</span>
        {samePair ? <span className="chip good">EN e PT do mesmo release</span> : null}
      </div>
      {search.english.length === 0 && !lockedEnglish ? (
        <div className="hint">
          Não encontramos legenda em inglês para este episódio. Envie o arquivo manualmente.
        </div>
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
          ? `Downloads restantes hoje: ${search.quota.remaining}${resetLabel(search.quota.resetAt)}`
          : "Downloads restantes hoje: informado pelo OpenSubtitles no primeiro download"}
        {" · "}
        <button className="link small" onClick={() => runSearch(true)} disabled={pending}>
          Buscar de novo
        </button>
      </p>
      {blockedByManual ? (
        <div className="hint">
          Este episódio já tem legenda enviada manualmente. A troca de versão ainda não é suportada.
        </div>
      ) : null}
      {complete && !blockedByManual ? (
        <div className="hint">Este episódio já tem as duas legendas do OpenSubtitles.</div>
      ) : null}
      {outOfQuota ? (
        <div className="hint">
          A cota de downloads de hoje não cobre esta escolha. Envie os arquivos manualmente ou tente depois.
        </div>
      ) : null}
      {error ? <p className="formerr">{error}</p> : null}
      <button className="btn wide" onClick={confirm} disabled={!canImport || pending}>
        {pending
          ? "Baixando…"
          : needed === 1
            ? "Baixar e processar · 1 download"
            : `Baixar e processar · ${needed} downloads`}
      </button>
      {manualLink}
    </>
  );
}
