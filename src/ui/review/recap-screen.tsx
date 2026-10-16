"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { XIcon } from "../icons";
import { LessonScreen, type LessonScreenView } from "../study/lesson-screen";
import { RecapLabelText, type RecapLabelView } from "./recap-label";

export type RecapScreenView = {
  recapId: string;
  step: number;
  steps: number;
  due: boolean;
  workTitle: string;
  label: RecapLabelView;
  title: string;
  summary: string;
  cards: number;
  lesson: LessonScreenView;
};

export function RecapScreen({ view }: { view: RecapScreenView }) {
  const t = useTranslations("recap");
  const [started, setStarted] = useState(false);
  const [lesson] = useState(view.lesson);
  if (started) return <LessonScreen view={lesson} />;
  return (
    <div className="lesson">
      <div
        className="col"
        style={{ gap: 16, padding: 16, minHeight: "100dvh", maxWidth: 480, margin: "0 auto" }}
      >
        <div className="row">
          <Link className="iconbtn" href="/review?tab=episodes" aria-label={t("leave")}>
            <XIcon />
          </Link>
          <span className="eyebrow" style={{ flex: 1 }}>
            {t("stepOf", { step: view.step, total: view.steps })}
          </span>
        </div>
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">
            {view.workTitle} · <RecapLabelText label={view.label} />
          </span>
          <h1 style={{ fontSize: 26 }}>{view.title}</h1>
        </div>
        <section className="card col" style={{ gap: 10 }}>
          <h2 style={{ fontSize: 20 }}>{t("whatHappened")}</h2>
          <p>{view.summary || t("noSummary")}</p>
          <p className="small muted">{t("summaryNote", { count: lesson.exercises.length })}</p>
        </section>
        <section className="card col" style={{ gap: 8 }}>
          <span className="eyebrow">{t("coming")}</span>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            <span className="chip">{t("exercises", { count: lesson.exercises.length })}</span>
            <span className="chip">{t("cards", { count: view.cards })}</span>
          </div>
          {view.due ? null : <p className="small muted">{t("notDue")}</p>}
        </section>
        <span style={{ flex: 1 }} />
        <button
          className="btn wide"
          onClick={() => setStarted(true)}
          disabled={lesson.exercises.length === 0}
        >
          {t("start")}
        </button>
        {lesson.exercises.length === 0 ? <p className="small muted">{t("noExercises")}</p> : null}
      </div>
    </div>
  );
}
