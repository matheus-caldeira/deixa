"use client";

import Link from "next/link";
import { BackIcon, ChartIcon, SlidersIcon } from "../icons";
import { Sheet } from "./sheet";

export const MORE_LINKS = [
  { href: "/progress", label: "Progresso", detail: "Nível, sequência, XP e conquistas", Icon: ChartIcon },
  { href: "/settings", label: "Configurações", detail: "Chaves, uso da IA e servidor", Icon: SlidersIcon },
] as const;

export function MoreSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet label="Mais" onClose={onClose}>
      <h2 style={{ fontSize: 22 }}>Mais</h2>
      <div className="card" style={{ padding: "4px 16px" }}>
        {MORE_LINKS.map(({ href, label, detail, Icon }) => (
          <div key={href} className="ep" style={{ gridTemplateColumns: "1fr" }}>
            <Link className="scen" href={href} onClick={onClose}>
              <span className="ic">
                <Icon />
              </span>
              <span className="col" style={{ gap: 3, minWidth: 0 }}>
                <b>{label}</b>
                <span className="small muted">{detail}</span>
              </span>
              <span style={{ color: "var(--muted)", width: 20, transform: "rotate(180deg)" }}>
                <BackIcon />
              </span>
            </Link>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
