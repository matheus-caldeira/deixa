"use client";

import Image from "next/image";
import Link from "next/link";
import {
  CardsIcon,
  ChatIcon,
  CheckIcon,
  EarIcon,
  Icon,
  LockIcon,
  MarkerIcon,
  PlayIcon,
  type IconName,
} from "../icons";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { retryTrailAction } from "@/app/actions/study";
import { MISSION_XP } from "@/modules/gamification";
import type { CefrLevel } from "@/shared/levels";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";

export type HomeView = {
  level: CefrLevel;
  current: {
    episodeId: string;
    mediaTitle: string;
    label: string;
    episodeTitle: string;
    line: string;
    progressPercent: number;
    ready: boolean;
    imageUrl: string | null;
  } | null;
  xpToday: number;
  dailyGoal: number;
  streak: number;
  dueCount: number;
  trail: { index: number; tc: string; nm: string; ic: IconName; state: "done" | "current" | "locked" }[];
  studyHref: string | null;
  trailStatus: "ready" | "pending" | "failed";
  trailByAi: boolean;
  trailFailure: string | null;
  missions: { icon: "cards" | "ear" | "chat"; kind: string; value: number; max: number }[];
};

const MISSION_ICONS = { cards: CardsIcon, ear: EarIcon, chat: ChatIcon };
const TRAIL_POLL_MS = 4000;
const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function GoalRing({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="goalring">
      <svg viewBox="0 0 72 72" aria-hidden="true">
        <circle
          cx="36"
          cy="36"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity=".18"
          strokeWidth="8"
        />
        <circle
          cx="36"
          cy="36"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - ratio)}
        />
      </svg>
      <b>{Math.round(ratio * 100)}%</b>
    </div>
  );
}

export function HomeScreen({ view }: { view: HomeView }) {
  const t = useTranslations("home");
  const levels = useTranslations("levels");
  const errorText = useErrorText();
  const toast = useToast();
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const goalMet = view.xpToday >= view.dailyGoal;

  useEffect(() => {
    if (view.trailStatus !== "pending") return;
    const timer = setInterval(() => router.refresh(), TRAIL_POLL_MS);
    return () => clearInterval(timer);
  }, [router, view.trailStatus]);

  const retryTrail = () => {
    if (!view.current) return;
    const episodeId = view.current.episodeId;
    startRetry(async () => {
      const result = await retryTrailAction(episodeId).catch(() => null);
      if (!result?.ok) toast(result?.message ?? errorText(null));
      router.refresh();
    });
  };

  return (
    <>
      {view.current ? (
        <section className={`hero ${view.current.imageUrl ? "photo" : ""}`}>
          {view.current.imageUrl ? (
            <Image
              className="bg"
              src={view.current.imageUrl}
              alt=""
              width={780}
              height={439}
              sizes="(max-width: 480px) 100vw, 480px"
              priority
            />
          ) : null}
          <div className="col" style={{ gap: 4, minWidth: 0 }}>
            <span className="eyebrow">
              {t("continue")} · {view.current.mediaTitle} · {view.current.label}
            </span>
            <h1>{view.current.episodeTitle}</h1>
          </div>
          {view.current.line ? <span className="subline">{view.current.line}</span> : null}
          <div className="row">
            <div className="bar cue" style={{ flex: 1, background: "rgba(255,255,255,.15)" }}>
              <i style={{ width: `${view.current.progressPercent}%` }} />
            </div>
            <span className="small" style={{ fontVariantNumeric: "tabular-nums" }}>
              {view.current.progressPercent}%
            </span>
          </div>
          {view.studyHref ? (
            <Link className="btn cue wide" href={view.studyHref}>
              <PlayIcon width={18} height={18} /> {t("keepStudying")}
            </Link>
          ) : view.trailStatus === "pending" ? (
            <button className="btn cue wide" disabled>
              {t("buildingTrail")}
            </button>
          ) : null}
          {view.current.ready ? (
            <Link className="btn onDark wide" href={`/read/${view.current.episodeId}`}>
              <MarkerIcon width={18} height={18} /> {t("readAndMark")}
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="hero">
          <div className="col" style={{ gap: 4 }}>
            <span className="eyebrow">{t("startHere")}</span>
            <h1>{t("pickEpisode")}</h1>
          </div>
          <span className="subline">{t("pickEpisodeTarget")}</span>
          <Link className="btn cue wide" href="/catalog">
            <PlayIcon width={18} height={18} /> {t("exploreCatalog")}
          </Link>
        </section>
      )}

      <section className="card goalrow">
        <GoalRing value={view.xpToday} max={view.dailyGoal} />
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <span className="eyebrow">{t("dailyGoal")}</span>
          <b style={{ fontSize: 17 }}>{t("xpOfGoal", { xp: view.xpToday, goal: view.dailyGoal })}</b>
          <span className="small muted">
            {goalMet
              ? t("goalMet", { days: view.streak })
              : t("goalMissing", { xp: view.dailyGoal - view.xpToday, days: view.streak })}
          </span>
        </div>
      </section>

      {view.trailStatus === "pending" ? (
        <section className="card col" style={{ gap: 10 }}>
          <div className="pstep run">
            <span className="s" />
            <b>{t("buildingTrailAi")}</b>
            <span className="small muted mono">{view.level}</span>
          </div>
          <p className="small muted">{t("buildingTrailBody")}</p>
        </section>
      ) : null}
      {view.trailStatus === "failed" ? (
        <section className="card col" style={{ gap: 10 }}>
          <b>{t("trailFailed")}</b>
          <p className="small muted">
            {errorText(view.trailFailure)} {t("trailFailedBody")}
          </p>
          <button className="btn" onClick={retryTrail} disabled={retrying}>
            {retrying ? t("retrying") : t("retry")}
          </button>
        </section>
      ) : null}
      {view.trail.length > 0 ? (
        <section className="col" style={{ gap: 4 }}>
          <div className="sec-h">
            <h2>{t("episodeTrail")}</h2>
            <span className="chip brand">
              {view.level} · {view.trailByAi ? t("madeByAi") : levels(view.level)}
            </span>
          </div>
          <p className="small muted">{t("trailBody")}</p>
          <div className="trail">
            {view.trail.map((node, index) => {
              const state = node.state === "current" ? "cur" : node.state === "locked" ? "lock" : "done";
              const href = view.current ? `/study/${view.current.episodeId}/${node.index}` : "/";
              return (
                <div key={node.index} className={`tnode ${index % 2 ? "r" : "l"} ${state}`}>
                  {state === "cur" ? <span className="startpop">{t("start")}</span> : null}
                  {state === "lock" ? (
                    <button
                      className="dot"
                      aria-label={t("lockedNode", { name: node.nm })}
                      onClick={() => toast(t("unlockHint"))}
                    >
                      <LockIcon />
                    </button>
                  ) : (
                    <Link className="dot" href={href} aria-label={node.nm}>
                      {state === "done" ? <CheckIcon /> : <Icon name={node.ic} />}
                    </Link>
                  )}
                  <div className="lbl">
                    <div className="tc">{node.tc}</div>
                    <div className="nm">{node.nm}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="card col" style={{ gap: 12 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 18 }}>{t("todayReviews")}</h2>
          <Link className="link" href="/review">
            {t("review")}
          </Link>
        </div>
        <div className="row">
          <b style={{ fontFamily: "var(--f-display)", fontSize: 34, lineHeight: 1 }}>{view.dueCount}</b>
          <span className="small muted">{view.dueCount === 0 ? t("noDueCards") : t("dueCards")}</span>
        </div>
      </section>

      {view.missions.length > 0 ? (
        <section className="card missions">
          <div className="sec-h">
            <h2 style={{ fontSize: 18 }}>{t("missions")}</h2>
            <span className="small muted">{t("missionXp", { xp: MISSION_XP })}</span>
          </div>
          {view.missions.map((mission) => {
            const MissionIcon = MISSION_ICONS[mission.icon];
            return (
              <div className="mission" key={mission.kind}>
                <span className="ic">
                  <MissionIcon />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b className="small">{t(`mission.${mission.kind}`, { target: mission.max })}</b>
                  <div className="bar cue">
                    <i style={{ width: `${(mission.value / mission.max) * 100}%` }} />
                  </div>
                </div>
                <span className="small mono">
                  {mission.value}/{mission.max}
                </span>
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
