"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { studyEpisodeAction } from "@/app/actions/catalog";
import { retryTrailAction } from "@/app/actions/study";
import { startEpisodeConversationAction } from "@/app/actions/tutor";
import { Poster, type PosterData } from "../catalog/poster";
import { BackIcon, ChatIcon, CheckIcon, DocIcon, Icon, LockIcon, type IconName } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";

export type TrailNodeView = {
  index: number;
  state: "done" | "current" | "locked";
  icon: IconName;
  title: string;
  href: string | null;
};

export type TrailSectionStatus = "done" | "current" | "open" | "pending" | "missing";

export type TrailSectionView = {
  key: string;
  label: string;
  title: string;
  overview: string;
  status: TrailSectionStatus;
  progressPercent: number;
  nodes: TrailNodeView[];
  startEpisodeId: string | null;
  detail: { href: string; kind: "read" | "cards" } | null;
  conversation: { episodeId: string } | null;
};

export type TrailSeasonView = {
  key: string;
  label: string;
  done: number;
  total: number;
  locked: boolean;
  href: string;
  selected: boolean;
};

export type WorkTrailView = {
  kind: "series" | "movie" | "personal";
  title: string;
  poster: PosterData;
  manageHref: string;
  seasons: TrailSeasonView[];
  sections: TrailSectionView[];
  lockedSeason: { level: string; unlockAt: number; themes: string[] } | null;
  currentHref: string | null;
  failure: { episodeId: string; reason: string } | null;
};

const OFFSETS = [0, 46, 70, 46, 0, -46, -70, -46];
const PENDING_POLL_MS = 4000;

function useCurrentNode(enabled: boolean) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [position, setPosition] = useState<"visible" | "above" | "below">("visible");
  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;
    node.scrollIntoView({ block: "center" });
    const update = () => {
      const rect = node.getBoundingClientRect();
      setPosition(rect.bottom <= 0 ? "above" : rect.top >= window.innerHeight ? "below" : "visible");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [enabled]);
  return { ref, position };
}

function SectionStatusText({ section }: { section: TrailSectionView }) {
  const t = useTranslations("trail");
  const lessons = section.nodes.length;
  const done = section.nodes.filter((node) => node.state === "done").length;
  if (section.status === "done") return <>{t("status.done")}</>;
  if (section.status === "pending") return <>{t("status.pending")}</>;
  if (section.status === "missing") return <>{t("status.missing")}</>;
  if (done === 0 && section.status === "open") return <>{t("status.notStarted")}</>;
  return <>{t("status.lessons", { done, total: lessons })}</>;
}

function EpisodeConversation({ section, episodeId }: { section: TrailSectionView; episodeId: string }) {
  const t = useTranslations("trail");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const start = () =>
    startTransition(async () => {
      const result = await startEpisodeConversationAction(episodeId).catch(() => null);
      if (result && !result.ok) toast(result.message);
    });
  return (
    <section className="card col" style={{ gap: 10, boxShadow: "none", border: "2px solid var(--line)" }}>
      <div className="row">
        <span className="ic" style={{ width: 36, height: 36, flex: "none", color: "var(--brand)" }}>
          <ChatIcon />
        </span>
        <div className="col" style={{ gap: 0 }}>
          <b>{t("talkTitle")}</b>
          <span className="small muted">{t("talkOptional")}</span>
        </div>
      </div>
      <p className="note">{t("talkNoSpoiler", { label: section.label })}</p>
      <p className="small muted">{t("talkSource")}</p>
      <button className="btn wide" onClick={start} disabled={pending}>
        {t("talk")}
      </button>
    </section>
  );
}

function GuideSheet({ section, onClose }: { section: TrailSectionView; onClose: () => void }) {
  const t = useTranslations("trail");
  return (
    <Sheet label={section.title} onClose={onClose}>
      <div className="col" style={{ gap: 12 }}>
        <span className="eyebrow">{section.label}</span>
        <h2 style={{ fontSize: 22 }}>{section.title}</h2>
        <p>{section.overview || t("noOverview")}</p>
        {section.conversation ? (
          <EpisodeConversation section={section} episodeId={section.conversation.episodeId} />
        ) : null}
        {section.detail ? (
          <Link className="btn ghost wide" href={section.detail.href}>
            {t(section.detail.kind === "read" ? "readAndMark" : "cardsAndSources")}
          </Link>
        ) : null}
      </div>
    </Sheet>
  );
}

function SectionBanner({
  section,
  onGuide,
}: {
  section: TrailSectionView;
  onGuide: (section: TrailSectionView) => void;
}) {
  const t = useTranslations("trail");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const start = (episodeId: string) =>
    startTransition(async () => {
      const result = await studyEpisodeAction(episodeId);
      if (!result.ok) toast(result.message);
      router.refresh();
    });
  return (
    <div className={`wt-unit ${section.status}`}>
      <span className="eyebrow">
        {section.label} · <SectionStatusText section={section} />
      </span>
      <h2>{section.title}</h2>
      {section.overview ? <span className="sub">{section.overview}</span> : <span />}
      <button
        className="guide"
        onClick={() => onGuide(section)}
        aria-label={t("guide", { title: section.title })}
      >
        <DocIcon />
      </button>
      {section.status === "open" && section.startEpisodeId ? (
        <button
          className="btn ghost wide act"
          onClick={() => section.startEpisodeId && start(section.startEpisodeId)}
          disabled={pending}
        >
          {t("startEpisode")}
        </button>
      ) : null}
      {section.status === "missing" && section.detail ? (
        <Link className="btn ghost wide act" href={section.detail.href}>
          {t("importSubtitle")}
        </Link>
      ) : null}
    </div>
  );
}

function FailureCard({ failure }: { failure: NonNullable<WorkTrailView["failure"]> }) {
  const t = useTranslations("trail");
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const [retrying, startRetry] = useTransition();
  const retry = () =>
    startRetry(async () => {
      const result = await retryTrailAction(failure.episodeId).catch(() => null);
      if (!result?.ok) toast(result?.message ?? errorText(null));
      router.refresh();
    });
  return (
    <section className="card col" style={{ gap: 10 }}>
      <b>{t("failed")}</b>
      <p className="small muted">
        {errorText(failure.reason)} {t("failedBody")}
      </p>
      <button className="btn" onClick={retry} disabled={retrying}>
        {retrying ? t("retrying") : t("retry")}
      </button>
    </section>
  );
}

export function WorkTrailScreen({ view }: { view: WorkTrailView }) {
  const t = useTranslations("trail");
  const toast = useToast();
  const router = useRouter();
  const [guide, setGuide] = useState<TrailSectionView | null>(null);
  const hasCurrent = view.sections.some(
    (section) => section.status === "current" && section.nodes.some((node) => node.state === "current"),
  );
  const { ref, position } = useCurrentNode(hasCurrent);
  const building = view.sections.some((section) => section.status === "pending");
  const closeGuide = useCallback(() => setGuide(null), []);

  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => router.refresh(), PENDING_POLL_MS);
    return () => clearInterval(timer);
  }, [building, router]);

  const firstStep = view.sections.map((_, index) =>
    view.sections.slice(0, index).reduce((sum, section) => sum + section.nodes.length, 0),
  );
  const backVisible = hasCurrent ? position !== "visible" : view.currentHref !== null;
  return (
    <>
      <div className="wt-stick">
        <div className="wt-head">
          <Link className="iconbtn" href="/" aria-label={t("back")}>
            <BackIcon />
          </Link>
          <Poster media={view.poster} sizes="34px" />
          <div className="col" style={{ gap: 0, minWidth: 0, flex: 1 }}>
            <h1>{view.title}</h1>
            <span className="small muted">{t(`subtitle.${view.kind}`)}</span>
          </div>
          <Link className="link small" href={view.manageHref}>
            {t(view.kind === "personal" ? "manageSeries" : "episodes")}
          </Link>
        </div>
        {view.seasons.length > 1 ? (
          <nav className="wt-seasons" aria-label={t("seasons")}>
            {view.seasons.map((season) => (
              <Link
                key={season.key}
                className={season.selected ? "on" : ""}
                href={season.href}
                aria-current={season.selected ? "page" : undefined}
                replace
              >
                {season.locked ? <LockIcon /> : null}
                {season.label}
                {season.total > 0 ? (
                  <span className="cnt">
                    {season.done}/{season.total}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {view.failure ? <FailureCard failure={view.failure} /> : null}
      {building ? (
        <section className="card col" style={{ gap: 10 }}>
          <div className="pstep run">
            <span className="s" />
            <b>{t("building")}</b>
          </div>
          <p className="small muted">{t("buildingBody")}</p>
        </section>
      ) : null}
      {view.lockedSeason ? (
        <section className="card col" style={{ gap: 12 }}>
          <span className="eyebrow">{t("lockedSeason", { level: view.lockedSeason.level })}</span>
          <h2 style={{ fontSize: 20 }}>{t("unlockAt", { percent: view.lockedSeason.unlockAt })}</h2>
          {view.lockedSeason.themes.length > 0 ? (
            <>
              <p className="small muted">{t("plannedThemes")}</p>
              <div className="col wt-themes" style={{ gap: 8 }}>
                {view.lockedSeason.themes.map((theme) => (
                  <div key={theme} className="lt">
                    <LockIcon />
                    {theme}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {view.sections.length === 0 && !view.lockedSeason ? <p className="muted">{t("empty")}</p> : null}

      {view.sections.map((section, sectionIndex) => (
        <section key={section.key} className="col" style={{ gap: 0 }}>
          <SectionBanner section={section} onGuide={setGuide} />
          {section.nodes.length > 0 ? (
            <div className="wt-path">
              {section.nodes.map((node) => {
                const offset = OFFSETS[((firstStep[sectionIndex] ?? 0) + node.index) % OFFSETS.length] ?? 0;
                const style = { transform: `translateX(${offset}px)` };
                const icon =
                  node.state === "done" ? (
                    <CheckIcon />
                  ) : node.state === "locked" ? (
                    <LockIcon />
                  ) : (
                    <Icon name={node.icon} />
                  );
                const label =
                  node.title ||
                  (node.icon === "chest" ? t("finalChallenge") : t("lesson", { number: node.index + 1 }));
                const focus = node.state === "current" && section.status === "current";
                if (node.state === "locked" || !node.href) {
                  return (
                    <button
                      key={node.index}
                      className="wt-node locked"
                      style={style}
                      aria-label={t("lockedLesson", { name: label })}
                      onClick={() => toast(t("unlockHint"))}
                    >
                      {icon}
                    </button>
                  );
                }
                return (
                  <Link
                    key={node.index}
                    ref={focus ? ref : undefined}
                    className={`wt-node ${node.state === "current" && !focus ? "next" : node.state}`}
                    style={style}
                    href={node.href}
                    aria-label={node.state === "done" ? t("replayLesson", { name: label }) : label}
                  >
                    {focus ? <span className="wt-pop">{t("start")}</span> : null}
                    {icon}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ height: 18 }} />
          )}
        </section>
      ))}

      <div className="wt-legend">
        <span>
          <i style={{ background: "var(--cue)" }} />
          {t("legend.done")}
        </span>
        <span>
          <i style={{ background: "var(--brand)" }} />
          {t("legend.current")}
        </span>
        <span>
          <i style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }} />
          {t("legend.locked")}
        </span>
      </div>

      {backVisible ? (
        hasCurrent ? (
          <button
            className={`btn wt-back ${position === "above" ? "up" : ""}`}
            onClick={() => ref.current?.scrollIntoView({ block: "center", behavior: "smooth" })}
          >
            <BackIcon width={18} height={18} /> {t("backToCurrent")}
          </button>
        ) : view.currentHref ? (
          <Link className="btn wt-back" href={view.currentHref} replace>
            <BackIcon width={18} height={18} /> {t("backToCurrent")}
          </Link>
        ) : null
      ) : null}

      {guide ? <GuideSheet section={guide} onClose={closeGuide} /> : null}
    </>
  );
}
