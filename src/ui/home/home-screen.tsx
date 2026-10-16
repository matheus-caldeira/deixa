"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { startConversationAction } from "@/app/actions/tutor";
import { MISSION_XP } from "@/modules/gamification";
import { Poster, type PosterData } from "../catalog/poster";
import { CardsIcon, ChatIcon, EarIcon, Icon, MarkerIcon, PlayIcon, type IconName } from "../icons";
import { useToast } from "../shell/toast";

export type HomeView = {
  current: {
    mediaTitle: string;
    label: string;
    episodeTitle: string;
    progressPercent: number;
    lessons: { done: number; total: number } | null;
    building: boolean;
    trailHref: string;
    readHref: string | null;
    imageUrl: string | null;
  } | null;
  xpToday: number;
  dailyGoal: number;
  streak: number;
  dueCount: number;
  dueRecaps: number;
  others: {
    key: string;
    title: string;
    subtitle: string;
    progressPercent: number;
    href: string;
    poster: PosterData;
  }[];
  missions: { icon: "cards" | "ear" | "chat"; kind: string; value: number; max: number }[];
  tutor: {
    suggestedThemeId: string;
    suggestedIcon: IconName;
    continueSession: { id: string; themeId: string; title: string } | null;
  };
};

function TutorCard({ tutor }: { tutor: HomeView["tutor"] }) {
  const t = useTranslations("home");
  const talk = useTranslations("talk");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const themeTitle = (themeId: string, fallback: string) =>
    talk.has(`themes.${themeId}.title`) ? talk(`themes.${themeId}.title`) : fallback;
  const suggested = themeTitle(tutor.suggestedThemeId, tutor.suggestedThemeId);
  const start = () =>
    startTransition(async () => {
      const result = await startConversationAction({
        themeId: tutor.suggestedThemeId,
        customTopic: null,
      }).catch(() => null);
      if (result && !result.ok) toast(result.message);
    });
  return (
    <section className="card col" style={{ gap: 12 }}>
      <div className="sec-h">
        <h2 style={{ fontSize: 18 }}>{t("tutorTitle")}</h2>
        <Link className="link" href="/tutor">
          {t("tutorMore")}
        </Link>
      </div>
      <div className="row">
        <span className="ic" style={{ width: 40, height: 40, flex: "none", color: "var(--brand)" }}>
          <Icon name={tutor.suggestedIcon} />
        </span>
        <span className="small muted">{t("tutorBody", { theme: suggested })}</span>
      </div>
      {tutor.continueSession ? (
        <Link className="btn ghost wide" href={`/tutor/${tutor.continueSession.id}`}>
          <ChatIcon width={18} height={18} />{" "}
          {t("tutorContinue", {
            theme: themeTitle(tutor.continueSession.themeId, tutor.continueSession.title),
          })}
        </Link>
      ) : null}
      <button className="btn wide" onClick={start} disabled={pending}>
        {t("tutorStart", { theme: suggested })}
      </button>
    </section>
  );
}

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
  const router = useRouter();
  const goalMet = view.xpToday >= view.dailyGoal;
  const building = view.current?.building ?? false;

  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => router.refresh(), TRAIL_POLL_MS);
    return () => clearInterval(timer);
  }, [router, building]);

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
          <div className="row">
            <div className="bar cue" style={{ flex: 1, background: "rgba(255,255,255,.15)" }}>
              <i style={{ width: `${view.current.progressPercent}%` }} />
            </div>
            <span className="small" style={{ fontVariantNumeric: "tabular-nums" }}>
              {view.current.lessons
                ? t("lessonOf", {
                    number: Math.min(view.current.lessons.done + 1, view.current.lessons.total),
                    total: view.current.lessons.total,
                  })
                : `${view.current.progressPercent}%`}
            </span>
          </div>
          <Link className="btn cue wide" href={view.current.trailHref}>
            <PlayIcon width={18} height={18} /> {building ? t("buildingTrail") : t("continue")}
          </Link>
          {view.current.readHref ? (
            <Link className="btn onDark wide" href={view.current.readHref}>
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

      <Link
        className="card row"
        href={view.dueCount === 0 && view.dueRecaps > 0 ? "/review?tab=episodes" : "/review"}
      >
        <span className="ic" style={{ width: 44, height: 44, flex: "none", color: "var(--brand)" }}>
          <CardsIcon />
        </span>
        <span className="col" style={{ gap: 2, flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 16 }}>{t("todayReviews")}</h2>
          <span className="small muted">
            {view.dueCount === 0 && view.dueRecaps === 0
              ? t("noDueCards")
              : [
                  view.dueCount > 0 ? t("dueCardsCount", { count: view.dueCount }) : null,
                  view.dueRecaps > 0 ? t("dueRecaps", { count: view.dueRecaps }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </span>
        <span className="link">{t("review")}</span>
      </Link>

      {view.others.length > 0 ? (
        <section className="col" style={{ gap: 10 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 18 }}>{t("alsoStudying")}</h2>
          </div>
          {view.others.map((entry) => (
            <Link
              key={entry.key}
              className="card cont"
              style={{ padding: 10, width: "100%" }}
              href={entry.href}
            >
              <Poster media={entry.poster} sizes="64px" />
              <div className="col" style={{ gap: 4, minWidth: 0 }}>
                <b className="small">{entry.title}</b>
                <span className="small muted">{entry.subtitle}</span>
                <div className="bar" style={{ height: 6 }}>
                  <i style={{ width: `${entry.progressPercent}%` }} />
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      <TutorCard tutor={view.tutor} />

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
