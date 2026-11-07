"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { APP_NAME } from "@/shared/app";
import {
  CardsIcon,
  ChartIcon,
  ChatIcon,
  FilmIcon,
  KeyIcon,
  LockIcon,
  MarkerIcon,
  MicIcon,
  MusicIcon,
  TargetIcon,
} from "../icons";
import { Logo } from "../shell/logo";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

const STEPS = [
  { key: "pick", image: "/landing/leitura.png" },
  { key: "mark", image: "/landing/trilha.png" },
  { key: "review", image: "/landing/revisar.png" },
] as const;

const FEATURES: { key: string; icon: ReactNode }[] = [
  { key: "explore", icon: <FilmIcon /> },
  { key: "read", icon: <MarkerIcon /> },
  { key: "cards", icon: <CardsIcon /> },
  { key: "study", icon: <TargetIcon /> },
  { key: "music", icon: <MusicIcon /> },
  { key: "talk", icon: <ChatIcon /> },
  { key: "voice", icon: <MicIcon /> },
  { key: "progress", icon: <ChartIcon /> },
  { key: "keys", icon: <KeyIcon /> },
];

const MODES = ["family", "personal"] as const;
const LANGUAGES = ["en", "pt", "es", "fr"] as const;

export function LandingScreen() {
  const t = useTranslations("landing");
  const app = { app: APP_NAME };

  return (
    <div className="landing">
      <header className="landing-top">
        <Logo />
        <nav className="row" style={{ gap: 8 }}>
          <Link className="btn ghost" href="/login">
            {t("signIn")}
          </Link>
          <Link className="btn" href="/signup">
            {t("signUp")}
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="col" style={{ gap: 18 }}>
          <span className="eyebrow">{t("hero.eyebrow")}</span>
          <h1>{t("hero.title")}</h1>
          <p className="landing-lead">{t("hero.lead", app)}</p>
          <div className="row landing-ctas">
            <Link className="btn" href="/signup">
              {t("hero.primary")}
            </Link>
            <a className="btn ghost" href="#how">
              {t("hero.secondary")}
            </a>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {LANGUAGES.map((language) => (
              <span key={language} className="chip">
                {t(`languages.${language}`)}
              </span>
            ))}
          </div>
        </div>
        <Image
          className="landing-shot"
          src="/landing/explorar.png"
          alt={t("hero.imageAlt")}
          width={DESKTOP.width}
          height={DESKTOP.height}
          priority
        />
      </section>

      <section className="landing-band">
        <div className="col" style={{ gap: 10 }}>
          <span className="eyebrow">{t("problem.eyebrow")}</span>
          <h2>{t("problem.title")}</h2>
          <p className="muted">{t("problem.body", app)}</p>
        </div>
        <figure className="card landing-example" aria-label={t("example.label")}>
          <span className="eyebrow">{t("example.scene")}</span>
          <p className="landing-cue">
            {t("example.before")}
            <span className="w mk">{t("example.term")}</span>
            {t("example.after")}
          </p>
          <p className="muted small">{t("example.translation")}</p>
          <div className="landing-card">
            <span className="eyebrow">{t("example.cardLabel")}</span>
            <strong>{t("example.term")}</strong>
            <span className="small">{t("example.meaning")}</span>
          </div>
          <figcaption className="note">{t("example.caption")}</figcaption>
        </figure>
      </section>

      <section id="how" className="col" style={{ gap: 22 }}>
        <div className="col" style={{ gap: 8 }}>
          <span className="eyebrow">{t("how.eyebrow")}</span>
          <h2>{t("how.title")}</h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map((step, index) => (
            <li key={step.key} className="card col">
              <span className="landing-num">{index + 1}</span>
              <h3>{t(`how.${step.key}.title`)}</h3>
              <p className="muted small">{t(`how.${step.key}.body`)}</p>
              <Image
                className="landing-shot"
                src={step.image}
                alt={t(`how.${step.key}.imageAlt`)}
                width={PHONE.width}
                height={PHONE.height}
              />
            </li>
          ))}
        </ol>
      </section>

      <section className="col" style={{ gap: 22 }}>
        <div className="col" style={{ gap: 8 }}>
          <span className="eyebrow">{t("features.eyebrow")}</span>
          <h2>{t("features.title", app)}</h2>
        </div>
        <ul className="landing-features">
          {FEATURES.map((feature) => (
            <li key={feature.key} className="card">
              <span className="landing-icon">{feature.icon}</span>
              <h3>{t(`features.${feature.key}.title`)}</h3>
              <p className="muted small">{t(`features.${feature.key}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-band">
        <Image
          className="landing-shot"
          src="/landing/conversar.png"
          alt={t("tutor.imageAlt")}
          width={PHONE.width}
          height={770}
        />
        <div className="col" style={{ gap: 10 }}>
          <span className="eyebrow">{t("tutor.eyebrow")}</span>
          <h2>{t("tutor.title")}</h2>
          <p className="muted">{t("tutor.body")}</p>
          <ul className="landing-list">
            <li>{t("tutor.point1")}</li>
            <li>{t("tutor.point2")}</li>
            <li>{t("tutor.point3")}</li>
          </ul>
        </div>
      </section>

      <section className="landing-band">
        <figure className="card landing-example" aria-label={t("music.label")}>
          <span className="eyebrow">{t("music.time")}</span>
          <p className="muted">{t("music.line1")}</p>
          <p>
            <strong>{t("music.line2")}</strong>
          </p>
          <p className="muted small">{t("music.translation")}</p>
          <p className="muted">{t("music.line3")}</p>
          <figcaption className="note">{t("music.caption")}</figcaption>
        </figure>
        <div className="col" style={{ gap: 10 }}>
          <span className="eyebrow">{t("music.eyebrow")}</span>
          <h2>{t("music.title")}</h2>
          <p className="muted">{t("music.body", app)}</p>
          <ul className="landing-list">
            <li>{t("music.point1")}</li>
            <li>{t("music.point2")}</li>
            <li>{t("music.point3")}</li>
          </ul>
        </div>
      </section>

      <section className="col" style={{ gap: 22 }}>
        <div className="col" style={{ gap: 8 }}>
          <span className="eyebrow">{t("modes.eyebrow")}</span>
          <h2>{t("modes.title")}</h2>
        </div>
        <div className="landing-modes">
          {MODES.map((mode) => (
            <article key={mode} className="card col" style={{ gap: 8 }}>
              <h3>{t(`modes.${mode}.title`)}</h3>
              <p className="muted small">{t(`modes.${mode}.body`, app)}</p>
              <ul className="landing-list small">
                <li>{t(`modes.${mode}.point1`)}</li>
                <li>{t(`modes.${mode}.point2`)}</li>
                <li>{t(`modes.${mode}.point3`)}</li>
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="card landing-trust">
        <span className="landing-icon">
          <LockIcon />
        </span>
        <div className="col" style={{ gap: 6 }}>
          <h2>{t("trust.title")}</h2>
          <p className="muted small">{t("trust.body", app)}</p>
          <Link className="link" href="/privacy">
            {t("trust.link")}
          </Link>
        </div>
      </section>

      <section className="landing-final">
        <h2>{t("final.title")}</h2>
        <p>{t("final.body")}</p>
        <Link className="btn" href="/signup">
          {t("final.cta")}
        </Link>
      </section>

      <footer className="landing-foot">
        <span>{t("footer.free", app)}</span>
        <Link className="link" href="/privacy">
          {t("footer.privacy")}
        </Link>
        <span>{t("footer.tmdb")}</span>
        <span>{t("footer.lyrics")}</span>
      </footer>
    </div>
  );
}
