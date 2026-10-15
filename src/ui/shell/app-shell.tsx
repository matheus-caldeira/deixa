"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getInboxAction, type InboxView } from "@/app/actions/notifications";
import type { CefrLevel } from "@/shared/levels";
import {
  BellIcon,
  BoltIcon,
  CardsIcon,
  ChatIcon,
  FilmIcon,
  FlameIcon,
  FlameOffIcon,
  HomeIcon,
  MoreIcon,
} from "../icons";
import { CatalogOptionsSheet } from "../catalog/catalog-options-sheet";
import { UploadSheet } from "../catalog/upload-sheet";
import { Logo } from "./logo";
import { MORE_LINKS, MoreSheet } from "./more-sheet";
import { NotificationsSheet } from "./notifications-sheet";
import { ProfileSheet, type ProfileSheetData } from "./profile-sheet";

export type ShellData = {
  name: string;
  avatarColor: string;
  level: CefrLevel;
  streak: number;
  xpToday: number;
  goalMet: boolean;
  profile: ProfileSheetData;
  devShortcuts: boolean;
  unreadableKeys: string[];
};

type ShellActions = {
  openProfile: () => void;
  openUpload: (mediaId?: string) => void;
  openCatalogOptions: (title: string, mediaId?: string) => void;
};
const ShellContext = createContext<ShellActions>({
  openProfile: () => undefined,
  openUpload: () => undefined,
  openCatalogOptions: () => undefined,
});

export function useShell(): ShellActions {
  return useContext(ShellContext);
}

const TABS = [
  { href: "/", key: "home", Icon: HomeIcon },
  { href: "/catalog", key: "catalog", Icon: FilmIcon },
  { href: "/review", key: "review", Icon: CardsIcon },
  { href: "/tutor", key: "tutor", Icon: ChatIcon },
] as const;

const SCROLL_THRESHOLD = 4;
const OPEN_PROFILE_EVENT = "deixa:open-profile";

type Sheet =
  | { kind: "profile" }
  | { kind: "notifications" }
  | { kind: "more" }
  | { kind: "catalog-options"; title: string; mediaId?: string }
  | { kind: "upload"; mediaId?: string }
  | null;
const INBOX_REFRESH_MS = 15_000;
const EMPTY_INBOX: InboxView = { unread: 0, items: [] };

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const t = useTranslations("shell");
  const more = useTranslations("more");
  const levels = useTranslations("levels");
  const pathname = usePathname();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [scrolled, setScrolled] = useState(false);
  const [inbox, setInbox] = useState<InboxView>(EMPTY_INBOX);

  const refreshInbox = useCallback(() => {
    getInboxAction()
      .then((result) => {
        if (result.ok) setInbox(result.data);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const first = setTimeout(refreshInbox, 0);
    const timer = setInterval(refreshInbox, INBOX_REFRESH_MS);
    window.addEventListener("focus", refreshInbox);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", refreshInbox);
    };
  }, [refreshInbox]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const actions = useMemo<ShellActions>(
    () => ({
      openProfile: () => setSheet({ kind: "profile" }),
      openUpload: (mediaId) => setSheet({ kind: "upload", mediaId }),
      openCatalogOptions: (title, mediaId) => setSheet({ kind: "catalog-options", title, mediaId }),
    }),
    [],
  );

  useEffect(() => {
    window.addEventListener(OPEN_PROFILE_EVENT, actions.openProfile);
    return () => window.removeEventListener(OPEN_PROFILE_EVENT, actions.openProfile);
  }, [actions]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const inMore = MORE_LINKS.some((link) => isActive(link.href));

  return (
    <ShellContext.Provider value={actions}>
      <div className="shell">
        <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
          <button
            className="avatar"
            style={{ background: data.avatarColor }}
            onClick={actions.openProfile}
            aria-label={t("profileOf", { name: data.name })}
          >
            {data.name.slice(0, 1)}
          </button>
          <Link className="lvlchip" href="/progress" title={levels(data.level)}>
            {data.level}
          </Link>
          <span className="spacer" />
          <button
            className="stat bell"
            onClick={() => {
              refreshInbox();
              setSheet({ kind: "notifications" });
            }}
            aria-label={
              inbox.unread > 0 ? t("notificationsNew", { count: inbox.unread }) : t("notifications")
            }
          >
            <BellIcon />
            {inbox.unread > 0 ? <span className="badge">{inbox.unread}</span> : null}
          </button>
          <Link
            className="stat"
            href="/people"
            title={t("streak")}
            aria-label={t("streakLabel", { days: data.streak })}
          >
            {data.goalMet ? <FlameIcon /> : <FlameOffIcon />}
            {data.streak}
          </Link>
          <Link
            className="stat"
            href="/people"
            title={t("xpToday")}
            aria-label={t("xpTodayLabel", { xp: data.xpToday })}
          >
            <BoltIcon />
            {data.xpToday}
          </Link>
        </header>
        <main className="main">
          {data.unreadableKeys.length > 0 ? (
            <div className="alertbar" role="alert">
              <span>
                <b>{t("unreadableKeys", { keys: data.unreadableKeys.join(", ") })}</b> {t("unreadableBody")}
              </span>
              <Link className="link small" href="/settings">
                {t("openSettings")}
              </Link>
            </div>
          ) : null}
          {children}
        </main>
        <nav className="nav" aria-label={t("areas")}>
          <span className="navbrand">
            <Logo />
          </span>
          {TABS.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              className={isActive(href) ? "on" : ""}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon />
              <span>{t(`tabs.${key}`)}</span>
            </Link>
          ))}
          {MORE_LINKS.map(({ href, key, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`desk ${isActive(href) ? "on" : ""}`}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon />
              <span>{more(key)}</span>
            </Link>
          ))}
          <button
            className={`mob ${inMore ? "on" : ""}`}
            onClick={() => setSheet({ kind: "more" })}
            aria-haspopup="dialog"
            aria-label={t("moreAreas")}
          >
            <MoreIcon />
            <span>{t("more")}</span>
          </button>
        </nav>
      </div>
      {sheet?.kind === "profile" ? <ProfileSheet data={data.profile} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === "more" ? <MoreSheet onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === "catalog-options" ? (
        <CatalogOptionsSheet
          title={sheet.title}
          mediaId={sheet.mediaId}
          onAdd={() => setSheet({ kind: "upload", mediaId: sheet.mediaId })}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === "notifications" ? (
        <NotificationsSheet inbox={inbox} onChange={refreshInbox} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === "upload" ? (
        <UploadSheet
          mediaId={sheet.mediaId}
          devShortcuts={data.devShortcuts}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </ShellContext.Provider>
  );
}
