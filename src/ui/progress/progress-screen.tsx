"use client";

import { useFormatter, useTranslations } from "next-intl";
import { CEFR_LEVELS, levelIndex, nextLevel, type CefrLevel } from "@/shared/levels";
import { BoltIcon, FlameIcon, Icon, LockIcon, QuoteIcon, TargetIcon, type IconName } from "../icons";

export type ProgressView = {
  level: CefrLevel;
  levelPct: number;
  streak: number;
  longest: number;
  totalXp: number;
  learned: number;
  accuracy: number;
  dailyGoal: number;
  goalMet: boolean;
  weekly: number[];
  heat: number[];
  skills: { key: string; percent: number }[];
  achievements: { id: string; icon: IconName; unlocked: boolean }[];
};

const TODAY = 6;
const HEAT_LEVELS = ["none", "partial", "met", "bonus"] as const;

export function ProgressScreen({ view }: { view: ProgressView }) {
  const t = useTranslations("progress");
  const levels = useTranslations("levels");
  const format = useFormatter();
  const weekDays = t("weekDays").split(" ");
  const current = levelIndex(view.level);
  const upcoming = nextLevel(view.level);
  const highest = Math.max(...view.weekly, view.dailyGoal, 1);
  const unlocked = view.achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>{t("title")}</h1>
      <section className="card col" style={{ gap: 14 }}>
        <div className="sec-h">
          <div className="col" style={{ gap: 2 }}>
            <span className="eyebrow">{t("yourLevel")}</span>
            <h2 style={{ fontSize: 22 }}>
              {view.level} · {levels(view.level)}
            </h2>
          </div>
          <span className="small muted mono">
            {t("untilNext", { percent: view.levelPct, level: upcoming ?? "—" })}
          </span>
        </div>
        <div className="ladder">
          {CEFR_LEVELS.map((level, index) => (
            <div key={level} className={`rung ${index < current ? "past" : index === current ? "now" : ""}`}>
              <div className="b" style={{ height: 24 + index * 14 }}>
                {index === current ? <i style={{ height: `${view.levelPct}%` }} /> : null}
              </div>
              <span>{level}</span>
            </div>
          ))}
        </div>
        <p className="small muted">{t(`nextStep.${view.level}`)}</p>
      </section>
      <div className="tiles">
        <div className="tile">
          <FlameIcon />
          <div>
            <b>{t("days", { count: view.streak })}</b>
            <small>{t("streakRecord", { record: view.longest })}</small>
          </div>
        </div>
        <div className="tile">
          <BoltIcon />
          <div>
            <b>{format.number(view.totalXp)}</b>
            <small>{t("totalXp")}</small>
          </div>
        </div>
        <div className="tile" style={{ color: "var(--brand)" }}>
          <QuoteIcon />
          <div style={{ color: "var(--ink)" }}>
            <b>{format.number(view.learned)}</b>
            <small>{t("learned")}</small>
          </div>
        </div>
        <div className="tile" style={{ color: "var(--good)" }}>
          <TargetIcon />
          <div style={{ color: "var(--ink)" }}>
            <b>{view.accuracy}%</b>
            <small>{t("accuracy")}</small>
          </div>
        </div>
      </div>
      <section className="card col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 17 }}>{t("weekXp")}</h2>
          <span className="small muted">{t("goalPerDay", { goal: view.dailyGoal })}</span>
        </div>
        <div className="bars">
          {view.weekly.map((value, index) => (
            <div key={index} className={index === TODAY ? "today" : ""}>
              <em>{value}</em>
              <i style={{ height: `${Math.max(3, (value / highest) * 100 * 0.82)}%` }} />
            </div>
          ))}
        </div>
        <div className="barlbl">
          {weekDays.map((day, index) => (
            <span key={index} style={index === TODAY ? { color: "var(--brand)" } : undefined}>
              {index === TODAY ? t("today") : day}
            </span>
          ))}
        </div>
      </section>
      <section className="card col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 17 }}>{t("studiedDays")}</h2>
          <span className="small muted">{t("lastWeeks", { weeks: 5 })}</span>
        </div>
        <div className="heat">
          {view.heat.map((level, index) => (
            <i
              key={index}
              className={`h${level} ${index === view.heat.length - 1 ? "today" : ""}`}
              title={t(`heat.${HEAT_LEVELS[level] ?? "none"}`)}
            />
          ))}
        </div>
      </section>
      <section className="card col" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 17 }}>{t("skills")}</h2>
        {view.skills.map((skill) => (
          <div className="skill" key={skill.key}>
            <span>{t(`skill.${skill.key}`)}</span>
            <div className="bar">
              <i style={{ width: `${skill.percent}%` }} />
            </div>
            <b>{skill.percent}%</b>
          </div>
        ))}
      </section>
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 18 }}>{t("achievements")}</h2>
          <span className="small muted">
            {unlocked}/{view.achievements.length}
          </span>
        </div>
        <div className="achs">
          {view.achievements.map((achievement) => (
            <div key={achievement.id} className={`ach ${achievement.unlocked ? "" : "locked"}`}>
              <span className="medal">
                {achievement.unlocked ? <Icon name={achievement.icon} /> : <LockIcon />}
              </span>
              <b>{t(`achievement.${achievement.id}.title`)}</b>
              <small>{t(`achievement.${achievement.id}.detail`)}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
