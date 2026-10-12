"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getInboxAction, type InboxView } from "@/app/actions/notifications";
import type { CefrLevel } from "@/shared/levels";
import { LEVEL_NAMES } from "@/shared/levels";
import {
  BellIcon,
  BoltIcon,
  CardsIcon,
  ChartIcon,
  ChatIcon,
  FilmIcon,
  FlameIcon,
  FlameOffIcon,
  HomeIcon,
} from "../icons";
import { UploadSheet } from "../catalog/upload-sheet";
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

type ShellActions = { openProfile: () => void; openUpload: (mediaId?: string) => void };
const ShellContext = createContext<ShellActions>({
  openProfile: () => undefined,
  openUpload: () => undefined,
});

export function useShell(): ShellActions {
  return useContext(ShellContext);
}

const TABS = [
  { href: "/", label: "Início", Icon: HomeIcon },
  { href: "/catalog", label: "Explorar", Icon: FilmIcon },
  { href: "/review", label: "Revisar", Icon: CardsIcon },
  { href: "/tutor", label: "Conversar", Icon: ChatIcon },
  { href: "/progress", label: "Progresso", Icon: ChartIcon },
] as const;

const SCROLL_THRESHOLD = 4;

type Sheet = { kind: "profile" } | { kind: "notifications" } | { kind: "upload"; mediaId?: string } | null;
const INBOX_REFRESH_MS = 15_000;
const EMPTY_INBOX: InboxView = { unread: 0, items: [] };

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
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
    }),
    [],
  );

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <ShellContext.Provider value={actions}>
      <header className={`topbar ${scrolled ? "scrolled" : ""}`}>
        <button
          className="avatar"
          style={{ background: data.avatarColor }}
          onClick={actions.openProfile}
          aria-label={`Perfil de ${data.name}`}
        >
          {data.name.slice(0, 1)}
        </button>
        <Link className="lvlchip" href="/progress" title={LEVEL_NAMES[data.level]}>
          {data.level}
        </Link>
        <span className="spacer" />
        <button
          className="stat bell"
          onClick={() => {
            refreshInbox();
            setSheet({ kind: "notifications" });
          }}
          aria-label={inbox.unread > 0 ? `Notificações: ${inbox.unread} novas` : "Notificações"}
        >
          <BellIcon />
          {inbox.unread > 0 ? <span className="badge">{inbox.unread}</span> : null}
        </button>
        <Link
          className="stat"
          href="/people"
          title="Sequência"
          aria-label={`Sequência de ${data.streak} dias: ver quem está estudando`}
        >
          {data.goalMet ? <FlameIcon /> : <FlameOffIcon />}
          {data.streak}
        </Link>
        <Link
          className="stat"
          href="/people"
          title="XP hoje"
          aria-label={`${data.xpToday} XP hoje: ver quem está estudando`}
        >
          <BoltIcon />
          {data.xpToday}
        </Link>
      </header>
      <main className="main">
        {data.unreadableKeys.length > 0 ? (
          <div className="alertbar" role="alert">
            <span>
              <b>Chave ilegível: {data.unreadableKeys.join(", ")}.</b> A chave mestra deste servidor mudou ou
              o dado foi corrompido. Cadastre a chave de novo.
            </span>
            <button className="link small" onClick={actions.openProfile}>
              Abrir perfil
            </button>
          </div>
        ) : null}
        {children}
      </main>
      <nav className="nav" aria-label="Áreas">
        {TABS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={isActive(href) ? "on" : ""}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {sheet?.kind === "profile" ? <ProfileSheet data={data.profile} onClose={() => setSheet(null)} /> : null}
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
