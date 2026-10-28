"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { APP_NAME } from "@/shared/app";
import { BackIcon } from "../icons";

const SECTIONS = ["stored", "where", "ai", "audio", "limits", "rights", "control"] as const;

export function PrivacyScreen() {
  const t = useTranslations("privacy");
  return (
    <article className="col" style={{ gap: 16, paddingTop: 4 }}>
      <div className="row" style={{ gap: 8, alignItems: "center" }}>
        <Link className="iconbtn" href="/" aria-label={t("back")}>
          <BackIcon />
        </Link>
        <h1 style={{ fontSize: 26 }}>{t("title")}</h1>
      </div>
      <p className="muted">{t("intro", { app: APP_NAME })}</p>
      {SECTIONS.map((section) => (
        <section key={section} className="card col" style={{ gap: 6 }}>
          <h2 style={{ fontSize: 18 }}>{t(`${section}.title`)}</h2>
          <p className="small">{t(`${section}.body`, { app: APP_NAME })}</p>
        </section>
      ))}
    </article>
  );
}
