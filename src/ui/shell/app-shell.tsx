"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CefrLevel } from "@/shared/levels";
import { LEVEL_NAMES } from "@/shared/levels";
import {
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

type Sheet = { kind: "profile" } | { kind: "upload"; mediaId?: string } | null;

export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [scrolled, setScrolled] = useState(false);

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
        <span className="stat" title="Sequência">
          {data.goalMet ? <FlameIcon /> : <FlameOffIcon />}
          {data.streak}
        </span>
        <span className="stat" title="XP hoje">
          <BoltIcon />
          {data.xpToday}
        </span>
      </header>
      <main className="main">{children}</main>
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
