"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";
import {
  addLanguagePairAction,
  switchLanguagePairAction,
  updatePreferencesAction,
} from "@/app/actions/profile";
import { AUDIO_SPEEDS, DAILY_GOALS, type Accent, type UserLanguagePair } from "@/modules/identity";
import { APP_AUTHOR, APP_NAME, APP_VERSION } from "@/shared/app";
import { CEFR_LEVELS, type CefrLevel } from "@/shared/levels";
import { LOCALES, type Locale } from "@/shared/locales";
import { LANGUAGE_TAGS, STUDY_LANGUAGES, type StudyLanguage } from "@/shared/study-languages";
import { SlidersIcon } from "../icons";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

export type ProfileSheetData = {
  name: string;
  avatarColor: string;
  level: CefrLevel;
  dailyGoal: number;
  accent: Accent;
  audioSpeed: number;
  metadataProvider: string;
  pairs: UserLanguagePair[];
};

const ACCENTS: Accent[] = ["US", "UK"];

export function ProfileSheet({ data, onClose }: { data: ProfileSheetData; onClose: () => void }) {
  const t = useTranslations("profile");
  const tApp = useTranslations("app");
  const levels = useTranslations("levels");
  const localeNames = useTranslations("locales");
  const languages = useTranslations("languages");
  const currentLocale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [goal, setGoal] = useState(data.dailyGoal);
  const [accent, setAccent] = useState(data.accent);
  const [speed, setSpeed] = useState(data.audioSpeed);
  const [locale, setLocale] = useState(currentLocale);
  const [adding, setAdding] = useState(false);
  const [newTarget, setNewTarget] = useState<StudyLanguage>("es");
  const [newNative, setNewNative] = useState<StudyLanguage>(
    data.pairs.find((pair) => pair.active)?.native ?? "pt-BR",
  );
  const [newLevel, setNewLevel] = useState<CefrLevel>("A1");

  const switchPair = (pair: UserLanguagePair) =>
    startTransition(async () => {
      const result = await switchLanguagePairAction({ target: pair.target, native: pair.native });
      if (!result.ok) toast(result.message);
      router.refresh();
    });

  const addPair = () =>
    startTransition(async () => {
      const result = await addLanguagePairAction({ target: newTarget, native: newNative, level: newLevel });
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setAdding(false);
      router.refresh();
    });

  const save = (patch: {
    dailyGoal?: number;
    preferredAccent?: Accent;
    audioSpeed?: number;
    locale?: Locale;
  }) =>
    startTransition(async () => {
      const result = await updatePreferencesAction(patch);
      if (!result.ok) toast(result.message);
      router.refresh();
    });

  return (
    <Sheet label={t("sheet")} onClose={onClose}>
      <div className="row">
        <span
          className="avatar"
          style={{ background: data.avatarColor, width: 52, height: 52, fontSize: 22 }}
        >
          {data.name.slice(0, 1)}
        </span>
        <div className="col" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 22 }}>{data.name}</h2>
          <span className="small muted">
            {data.level} · {levels(data.level)}
          </span>
        </div>
      </div>

      <div className="field">
        <label>{t("languages")}</label>
        <div className="col" style={{ gap: 6 }}>
          {data.pairs.map((pair) => (
            <button
              key={`${pair.target}>${pair.native}`}
              type="button"
              className={`result ${pair.active ? "on" : ""}`}
              style={{ gridTemplateColumns: "1fr auto" }}
              onClick={() => (pair.active ? undefined : switchPair(pair))}
              aria-pressed={pair.active}
            >
              <span className="col" style={{ gap: 2, minWidth: 0 }}>
                <b>{t("pairLabel", { target: languages(pair.target), native: languages(pair.native) })}</b>
                <span className="small muted">
                  {LANGUAGE_TAGS[pair.target]} · {pair.level} · {levels(pair.level)}
                </span>
              </span>
              <span className="chip brand">{pair.active ? t("activePair") : t("usePair")}</span>
            </button>
          ))}
          {adding ? (
            <div className="col" style={{ gap: 8 }}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="pair-native">{t("nativeLanguage")}</label>
                  <select
                    id="pair-native"
                    value={newNative}
                    onChange={(event) => setNewNative(event.target.value as StudyLanguage)}
                  >
                    {STUDY_LANGUAGES.map((option) => (
                      <option key={option} value={option}>
                        {languages(option)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="pair-target">{t("targetLanguage")}</label>
                  <select
                    id="pair-target"
                    value={newTarget}
                    onChange={(event) => setNewTarget(event.target.value as StudyLanguage)}
                  >
                    {STUDY_LANGUAGES.filter((option) => option !== newNative).map((option) => (
                      <option key={option} value={option}>
                        {languages(option)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="pair-level">{t("pairLevel")}</label>
                <select
                  id="pair-level"
                  value={newLevel}
                  onChange={(event) => setNewLevel(event.target.value as CefrLevel)}
                >
                  {CEFR_LEVELS.map((option) => (
                    <option key={option} value={option}>
                      {option} · {levels(option)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={addPair}
                  disabled={newTarget === newNative}
                >
                  {t("addPair")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="link small"
              style={{ alignSelf: "flex-start" }}
              onClick={() => setAdding(true)}
            >
              {t("addPairLink")}
            </button>
          )}
        </div>
      </div>

      <div className="field">
        <label>{t("dailyGoal")}</label>
        <div className="seg">
          {DAILY_GOALS.map((option) => (
            <button
              key={option.xp}
              className={goal === option.xp ? "on" : ""}
              onClick={() => {
                setGoal(option.xp);
                save({ dailyGoal: option.xp });
              }}
            >
              {t(`goals.${option.key}`)}
              <br />
              <span className="mono small">{option.xp} XP</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{t("accent")}</label>
        <div className="seg">
          {ACCENTS.map((option) => (
            <button
              key={option}
              className={accent === option ? "on" : ""}
              onClick={() => {
                setAccent(option);
                save({ preferredAccent: option });
              }}
            >
              {t(`accents.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{t("speed")}</label>
        <div className="seg">
          {AUDIO_SPEEDS.map((option) => (
            <button
              key={option}
              className={speed === option ? "on" : ""}
              onClick={() => {
                setSpeed(option);
                save({ audioSpeed: option });
              }}
            >
              {option.toLocaleString(currentLocale)}×
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{t("language")}</label>
        <div className="seg">
          {LOCALES.map((option) => (
            <button
              key={option}
              className={locale === option ? "on" : ""}
              onClick={() => {
                setLocale(option);
                save({ locale: option });
              }}
            >
              {localeNames(option)}
            </button>
          ))}
        </div>
      </div>

      <Link className="btn ghost wide" href="/settings" onClick={onClose}>
        <SlidersIcon width={18} height={18} /> {t("settings")}
      </Link>

      <form action={signOutAction}>
        <button className="btn ghost wide" type="submit">
          {t("switchProfile")}
        </button>
      </form>

      <div className="about">
        <span className="eyebrow">{t("about")}</span>
        <span>
          <b>{APP_NAME}</b> {APP_VERSION} · {tApp("tagline")}
        </span>
        <span>
          {t.rich("createdBy", { name: APP_AUTHOR.name, b: (chunks) => <b>{chunks}</b> })}{" "}
          <a className="link" href={`mailto:${APP_AUTHOR.email}`}>
            {APP_AUTHOR.email}
          </a>{" "}
          ·{" "}
          <a className="link" href={`tel:${APP_AUTHOR.phoneHref}`}>
            {APP_AUTHOR.phone}
          </a>
        </span>
        <span>
          {t("metadata")} <b>TMDB</b>
          {data.metadataProvider === "tmdb" ? "" : t("demoMetadata")}
        </span>
        <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        <span>{t.rich("subtitles", { b: (chunks) => <b>{chunks}</b> })}</span>
      </div>
    </Sheet>
  );
}
