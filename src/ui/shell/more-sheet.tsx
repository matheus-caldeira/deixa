"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BackIcon, ChartIcon, LockIcon, SlidersIcon, SwapIcon } from "../icons";
import { Sheet } from "./sheet";

export const MORE_LINKS = [
  { href: "/progress", key: "progress", Icon: ChartIcon },
  { href: "/transfer", key: "transfer", Icon: SwapIcon },
  { href: "/settings", key: "settings", Icon: SlidersIcon },
  { href: "/privacy", key: "privacy", Icon: LockIcon },
] as const;

export function MoreSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("more");
  return (
    <Sheet label={t("title")} onClose={onClose}>
      <h2 style={{ fontSize: 22 }}>{t("title")}</h2>
      <div className="card" style={{ padding: "4px 16px" }}>
        {MORE_LINKS.map(({ href, key, Icon }) => (
          <div key={href} className="ep" style={{ gridTemplateColumns: "1fr" }}>
            <Link className="scen" href={href} onClick={onClose}>
              <span className="ic">
                <Icon />
              </span>
              <span className="col" style={{ gap: 3, minWidth: 0 }}>
                <b>{t(key)}</b>
                <span className="small muted">{t(`${key}Detail`)}</span>
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
