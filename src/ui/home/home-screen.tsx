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
import { useToast } from "../shell/toast";

export type HomeView = {
  level: string;
  levelName: string;
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
  missions: { icon: "cards" | "ear" | "chat"; title: string; value: number; max: number }[];
};

const MISSION_ICONS = { cards: CardsIcon, ear: EarIcon, chat: ChatIcon };
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
  const toast = useToast();
  const goalMet = view.xpToday >= view.dailyGoal;

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
              Continuar · {view.current.mediaTitle} · {view.current.label}
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
              <PlayIcon width={18} height={18} /> Continuar estudando
            </Link>
          ) : null}
          {view.current.ready ? (
            <Link className="btn onDark wide" href={`/read/${view.current.episodeId}`}>
              <MarkerIcon width={18} height={18} /> Ler episódio e marcar
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="hero">
          <div className="col" style={{ gap: 4 }}>
            <span className="eyebrow">Comece por aqui</span>
            <h1>Escolha um episódio</h1>
          </div>
          <span className="subline">Pick an episode.</span>
          <Link className="btn cue wide" href="/catalog">
            <PlayIcon width={18} height={18} /> Explorar o catálogo
          </Link>
        </section>
      )}

      <section className="card goalrow">
        <GoalRing value={view.xpToday} max={view.dailyGoal} />
        <div className="col" style={{ gap: 4, minWidth: 0 }}>
          <span className="eyebrow">Meta do dia</span>
          <b style={{ fontSize: 17 }}>
            {view.xpToday} de {view.dailyGoal} XP
          </b>
          <span className="small muted">
            {goalMet
              ? `Meta cumprida. Sequência garantida: ${view.streak} dias.`
              : `Faltam ${view.dailyGoal - view.xpToday} XP para manter os ${view.streak} dias de sequência.`}
          </span>
        </div>
      </section>

      {view.trail.length > 0 ? (
        <section className="col" style={{ gap: 4 }}>
          <div className="sec-h">
            <h2>Trilha do episódio</h2>
            <span className="chip brand">
              {view.level} · {view.levelName}
            </span>
          </div>
          <p className="small muted">Cada parada é uma cena da legenda, marcada pelo tempo do episódio.</p>
          <div className="trail">
            {view.trail.map((node, index) => {
              const state = node.state === "current" ? "cur" : node.state === "locked" ? "lock" : "done";
              const href = view.current ? `/study/${view.current.episodeId}/${node.index}` : "/";
              return (
                <div key={node.index} className={`tnode ${index % 2 ? "r" : "l"} ${state}`}>
                  {state === "cur" ? <span className="startpop">COMEÇAR</span> : null}
                  {state === "lock" ? (
                    <button
                      className="dot"
                      aria-label={`${node.nm} (bloqueada)`}
                      onClick={() => toast("Conclua a cena anterior para liberar esta.")}
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
          <h2 style={{ fontSize: 18 }}>Revisões de hoje</h2>
          <Link className="link" href="/review">
            Revisar
          </Link>
        </div>
        <div className="row">
          <b style={{ fontFamily: "var(--f-display)", fontSize: 34, lineHeight: 1 }}>{view.dueCount}</b>
          <span className="small muted">
            {view.dueCount === 0
              ? "Nenhum cartão vencido. Marque falas num episódio para criar novos."
              : "cartões vencidos. Revisar agora rende XP extra e protege a memória."}
          </span>
        </div>
      </section>

      {view.missions.length > 0 ? (
        <section className="card missions">
          <div className="sec-h">
            <h2 style={{ fontSize: 18 }}>Missões do dia</h2>
            <span className="small muted">+20 XP cada</span>
          </div>
          {view.missions.map((mission) => {
            const MissionIcon = MISSION_ICONS[mission.icon];
            return (
              <div className="mission" key={mission.title}>
                <span className="ic">
                  <MissionIcon />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b className="small">{mission.title}</b>
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
