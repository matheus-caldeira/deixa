"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { renamePersonalSeriesAction, setPersonalSeriesLevelAction } from "@/app/actions/personal-series";
import { LEVEL_MODES, MAX_SERIES_NAME, type LevelMode, type SeriesLevel } from "@/modules/personal-series";
import { CEFR_LEVELS, type CefrLevel } from "@/shared/levels";
import { BackIcon, LockIcon, PenIcon, PlayIcon, SparkIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";

export type SeriesEpisodeView = {
  id: string;
  number: number;
  title: string;
  cardCount: number;
  sourceCount: number;
  progress: number;
  fresh: boolean;
};

export type SeriesScreenView = {
  id: string;
  name: string | null;
  description: string | null;
  descriptionUpdatedAt: string | null;
  descriptionBasis: { conversations: number; cards: number } | null;
  level: SeriesLevel;
  userLevel: CefrLevel;
  activeLevel: CefrLevel;
  seasons: { id: string; number: number; level: CefrLevel; episodes: SeriesEpisodeView[] }[];
  upcoming: { level: CefrLevel; percent: number; unlockAt: number; themes: string[] } | null;
};

const UPCOMING_TAB = "upcoming";

function RenameSheet(props: { current: string; seriesId: string; onClose: () => void }) {
  const t = useTranslations("series");
  const toast = useToast();
  const errorText = useErrorText();
  const router = useRouter();
  const [name, setName] = useState(props.current);
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const result = await renamePersonalSeriesAction(name).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      props.onClose();
      router.refresh();
    });
  return (
    <Sheet label={t("nameTitle")} onClose={props.onClose}>
      <h2 style={{ fontSize: 20 }}>{t("nameTitle")}</h2>
      <div className="field">
        <label htmlFor="series-name">{t("nameLabel")}</label>
        <input
          id="series-name"
          value={name}
          maxLength={MAX_SERIES_NAME}
          placeholder={t("defaultName")}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <p className="note">{t("nameNote", { id: props.seriesId.slice(0, 8) })}</p>
      <button className="btn block" onClick={save} disabled={pending}>
        {t("save")}
      </button>
    </Sheet>
  );
}

function LevelSheet(props: { level: SeriesLevel; userLevel: CefrLevel; onClose: () => void }) {
  const t = useTranslations("series");
  const toast = useToast();
  const errorText = useErrorText();
  const router = useRouter();
  const [mode, setMode] = useState<LevelMode>(props.level.mode);
  const [min, setMin] = useState<CefrLevel>(props.level.min ?? props.userLevel);
  const [max, setMax] = useState<CefrLevel>(props.level.max ?? props.userLevel);
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const result = await setPersonalSeriesLevelAction({
        mode,
        min: mode === "auto" ? null : min,
        max: mode === "custom" ? max : null,
      }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      props.onClose();
      router.refresh();
    });
  const picker = (id: string, value: CefrLevel, onChange: (level: CefrLevel) => void) => (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as CefrLevel)}>
      {CEFR_LEVELS.map((level) => (
        <option key={level}>{level}</option>
      ))}
    </select>
  );
  return (
    <Sheet label={t("levelTitle")} onClose={props.onClose}>
      <h2 style={{ fontSize: 20 }}>{t("levelTitle")}</h2>
      <p className="small muted">{t("levelBody")}</p>
      <div className="seg">
        {LEVEL_MODES.map((option) => (
          <button key={option} className={mode === option ? "on" : ""} onClick={() => setMode(option)}>
            {t(`modes.${option}`)}
          </button>
        ))}
      </div>
      {mode === "auto" ? <p className="note">{t("autoNote", { level: props.userLevel })}</p> : null}
      {mode === "fixed" ? (
        <div className="field">
          <label htmlFor="level-only">{t("levelOnly")}</label>
          {picker("level-only", min, setMin)}
        </div>
      ) : null}
      {mode === "custom" ? (
        <>
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="level-from">{t("levelFrom")}</label>
              {picker("level-from", min, setMin)}
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="level-to">{t("levelTo")}</label>
              {picker("level-to", max, setMax)}
            </div>
          </div>
          <p className="note">{t("customNote")}</p>
        </>
      ) : null}
      <button className="btn block" onClick={save} disabled={pending}>
        {t("save")}
      </button>
    </Sheet>
  );
}

export function SeriesScreen({ view }: { view: SeriesScreenView }) {
  const t = useTranslations("series");
  const format = useFormatter();
  const [sheet, setSheet] = useState<"name" | "level" | null>(null);
  const active = view.seasons.find((season) => season.level === view.activeLevel) ?? view.seasons.at(-1);
  const [tab, setTab] = useState<string>(active?.id ?? UPCOMING_TAB);
  const season = view.seasons.find((candidate) => candidate.id === tab);
  const episodes = view.seasons.flatMap((candidate) => candidate.episodes);
  const cards = episodes.reduce((sum, episode) => sum + episode.cardCount, 0);
  const name = view.name ?? t("defaultName");
  const levelLabel =
    view.level.mode === "fixed"
      ? t("levelFixed", { level: view.level.min ?? view.userLevel })
      : view.level.mode === "custom"
        ? t("levelCustom", { min: view.level.min ?? "", max: view.level.max ?? "" })
        : t("levelAuto", { level: view.activeLevel });

  return (
    <>
      <Link className="back" href="/tutor">
        <BackIcon />
        {t("back")}
      </Link>
      <div className="dhead">
        <div className="poster pposter">
          <span className="pm">{t("personal")}</span>
          <span className="pt">{name}</span>
        </div>
        <div className="col">
          <div className="row" style={{ gap: 6, alignItems: "flex-start" }}>
            <h1 style={{ fontSize: 26, lineHeight: 1.05, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
              {name}
            </h1>
            <button className="iconbtn" onClick={() => setSheet("name")} aria-label={t("rename")}>
              <PenIcon />
            </button>
          </div>
          <span className="small muted">{t("onlyYou")}</span>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className="chip brand">{t("episodes", { count: episodes.length })}</span>
            <span className="chip">{t("cards", { count: cards })}</span>
            <button className="chip warn" onClick={() => setSheet("level")}>
              {levelLabel}
            </button>
          </div>
        </div>
      </div>
      <div className="descbox">
        <div className="row" style={{ gap: 6 }}>
          <SparkIcon width={16} height={16} style={{ color: "var(--brand)" }} />
          <span className="eyebrow">{t("aboutTitle")}</span>
        </div>
        <p>{view.description ?? t("aboutEmpty")}</p>
        {view.descriptionUpdatedAt && view.descriptionBasis ? (
          <span className="small muted">
            {t("aboutUpdated", {
              date: format.dateTime(new Date(view.descriptionUpdatedAt), {
                day: "2-digit",
                month: "2-digit",
              }),
              conversations: view.descriptionBasis.conversations,
              cards: view.descriptionBasis.cards,
            })}
          </span>
        ) : null}
      </div>
      <div className="seg">
        {view.seasons.map((candidate) => (
          <button
            key={candidate.id}
            className={tab === candidate.id ? "on" : ""}
            onClick={() => setTab(candidate.id)}
          >
            {t("seasonTab", { number: candidate.number, level: candidate.level })}
          </button>
        ))}
        {view.upcoming ? (
          <button
            className={tab === UPCOMING_TAB ? "on" : ""}
            style={{ display: "inline-flex", gap: 4, alignItems: "center", justifyContent: "center" }}
            onClick={() => setTab(UPCOMING_TAB)}
          >
            <LockIcon width={12} height={12} />{" "}
            {t("seasonTab", { number: view.seasons.length + 1, level: view.upcoming.level })}
          </button>
        ) : null}
      </div>
      {season ? (
        <>
          <div className="sec-h">
            <h2>{t("seasonTitle", { number: season.number })}</h2>
            <span className="chip warn">{season.level}</span>
          </div>
          {season.episodes.length === 0 ? (
            <p className="small muted">{t("seasonEmpty")}</p>
          ) : (
            <div className="card" style={{ padding: "4px 16px" }}>
              {season.episodes.map((episode) => {
                const fresh = episode.fresh;
                return (
                  <div className={`ep ${fresh ? "fresh" : ""}`} key={episode.id}>
                    <span className="num">E{episode.number}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                        <span className="t">{episode.title}</span>
                        {fresh ? <span className="newbadge">{t("newBadge")}</span> : null}
                      </div>
                      <span className="small muted">
                        {t("episodeMeta", { cards: episode.cardCount, sources: episode.sourceCount })}
                      </span>
                      <div className={`bar ${episode.progress === 100 ? "good" : ""}`}>
                        <i style={{ width: `${episode.progress}%` }} />
                      </div>
                    </div>
                    <Link
                      className="playbtn"
                      href={`/series/${episode.id}`}
                      aria-label={t("open", { title: episode.title })}
                    >
                      <PlayIcon />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : view.upcoming ? (
        <div className="card col" style={{ gap: 10 }}>
          <div className="row">
            <LockIcon width={22} height={22} style={{ color: "var(--muted)", flex: "none" }} />
            <span className="small">
              {t("locked", {
                unlockAt: view.upcoming.unlockAt,
                level: view.activeLevel,
                percent: view.upcoming.percent,
              })}
            </span>
          </div>
          <div className="bar cue">
            <i
              style={{ width: `${Math.min(100, (view.upcoming.percent / view.upcoming.unlockAt) * 100)}%` }}
            />
          </div>
          {view.upcoming.themes.length > 0 ? (
            <>
              <span className="eyebrow">{t("upcomingThemes")}</span>
              {view.upcoming.themes.map((theme) => (
                <span key={theme} className="small">
                  · {theme}
                </span>
              ))}
            </>
          ) : null}
          <p className="note">{t("upcomingNote", { level: view.upcoming.level })}</p>
        </div>
      ) : null}
      <div className="fab" style={{ cursor: "default" }}>
        <SparkIcon />
        {t("aiCreates")}
      </div>
      {sheet === "name" ? (
        <RenameSheet current={view.name ?? ""} seriesId={view.id} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "level" ? (
        <LevelSheet level={view.level} userLevel={view.userLevel} onClose={() => setSheet(null)} />
      ) : null}
    </>
  );
}
