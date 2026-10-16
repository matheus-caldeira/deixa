"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { completePersonalLessonAction } from "@/app/actions/personal-series";
import { completeLessonAction } from "@/app/actions/study";
import {
  correctAnswerText,
  gradeAnswer,
  type Answer,
  type Exercise,
  type LessonResult,
} from "@/modules/study";
import { formatTimecode } from "@/shared/time";
import { CheckIcon, SoundIcon, TurtleIcon, XIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { playSound } from "../shell/sounds";
import { useToast } from "../shell/toast";
import { useSpeech } from "../shell/use-speech";

export type LessonScreenView = {
  episodeId: string;
  nodeIndex: number;
  seed: string;
  title: string;
  level: string;
  replay: boolean;
  audioSpeed: number;
  exercises: Exercise[];
  source?: "episode" | "personal";
};

type SpeechKind = "cue" | "item";

const PRAISE_COUNT = 4;
type Phase = "ask" | "right" | "wrong";

function SpeakButtons(props: {
  cueId: string;
  kind: SpeechKind;
  big?: boolean;
  speech: ReturnType<typeof useSpeech>;
}) {
  const t = useTranslations("lesson");
  const loading = props.speech.loadingId === props.cueId;
  return (
    <div className="row" style={{ gap: props.big ? 14 : 10 }}>
      <button
        className={`speak ${props.big ? "big" : ""}`}
        onClick={() => props.speech.play(props.kind, props.cueId)}
        aria-label={t("listen")}
        disabled={loading}
      >
        <SoundIcon />
        {loading ? <span className="small">{t("generating")}</span> : null}
      </button>
      <button
        className="speak slow"
        onClick={() => props.speech.play(props.kind, props.cueId, true)}
        aria-label={t("listenSlow")}
      >
        <TurtleIcon />
      </button>
    </div>
  );
}

export function LessonScreen({ view }: { view: LessonScreenView }) {
  const t = useTranslations("lesson");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [position, setPosition] = useState(0);
  const [phase, setPhase] = useState<Phase>("ask");
  const [selected, setSelected] = useState<number | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const startedAt = useRef(0);
  const speech = useSpeech({ speed: view.audioSpeed, onError: toast });
  const exercise = view.exercises[position];
  const personal = view.source === "personal";
  const backHref = personal ? `/series/${view.episodeId}` : "/";
  const speechKind: SpeechKind = personal ? "item" : "cue";

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const inProgress =
    result === null &&
    (position > 0 || answers.length > 0 || selected !== null || built.length > 0 || text.trim() !== "");

  useEffect(() => {
    if (!inProgress) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inProgress]);

  const exit = () => {
    router.push(backHref);
  };

  if (view.exercises.length === 0) {
    return (
      <div className="lesson">
        <div className="done">
          <h1>{t("noExercises")}</h1>
          <p className="muted">{t("noExercisesBody")}</p>
          <Link className="btn" href={backHref}>
            {t("back")}
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    const minutes = Math.floor(elapsed / 60);
    const seconds = String(elapsed % 60).padStart(2, "0");
    return (
      <div className="lesson">
        <div className="done">
          <svg className="clap" viewBox="0 0 120 96" aria-hidden="true">
            <rect x="10" y="38" width="100" height="54" rx="8" fill="var(--ink)" />
            <g transform="rotate(-14 14 36)">
              <rect x="10" y="18" width="100" height="18" rx="4" fill="var(--ink)" />
              <path
                d="M24 18l12 18M48 18l12 18M72 18l12 18M96 18l10 15"
                stroke="var(--cue)"
                strokeWidth="7"
              />
            </g>
            <text
              x="60"
              y="72"
              textAnchor="middle"
              fontFamily="var(--f-mono)"
              fontSize="13"
              fontWeight="700"
              fill="var(--cue)"
            >
              {t(result.passed ? "clapOk" : "clapAgain", { block: view.nodeIndex + 1 })}
            </text>
          </svg>
          <div className="col" style={{ gap: 6, alignItems: "center" }}>
            <h1>
              {!result.passed
                ? t("notYet")
                : result.episodeCompleted
                  ? t("episodeDone")
                  : result.accuracy === 100
                    ? t("perfectBlock")
                    : t("blockDone")}
            </h1>
            <p className="muted">
              {!result.passed
                ? t("needAccuracy", { percent: result.requiredAccuracy })
                : result.replay
                  ? result.xp > 0
                    ? t("replayHalfXp")
                    : t("replayNoXp")
                  : t("episodeAt", { percent: result.progressPercent })}
            </p>
          </div>
          <div className="donestats">
            <div className="dstat" style={{ borderColor: "var(--cue)" }}>
              <div className="h" style={{ background: "var(--cue)", color: "var(--cue-ink)" }}>
                XP
              </div>
              <div className="v">+{result.xp}</div>
            </div>
            <div className="dstat" style={{ borderColor: "var(--good)" }}>
              <div className="h" style={{ background: "var(--good)" }}>
                {t("accuracy")}
              </div>
              <div className="v">{result.accuracy}%</div>
            </div>
            <div className="dstat" style={{ borderColor: "var(--brand)" }}>
              <div className="h" style={{ background: "var(--brand)" }}>
                {t("time")}
              </div>
              <div className="v">
                {minutes}:{seconds}
              </div>
            </div>
          </div>
          {result.queuedForReview > 0 ? (
            <p className="small muted">{t("queued", { count: result.queuedForReview })}</p>
          ) : null}
        </div>
        <div className="lfoot col" style={{ gap: 12 }}>
          {!result.passed ? (
            <button
              className="btn wide"
              onClick={() => {
                setResult(null);
                setPosition(0);
                setPhase("ask");
                setSelected(null);
                setBuilt([]);
                setText("");
                setAnswers([]);
                startedAt.current = Date.now();
              }}
            >
              {t("tryAgain")}
            </button>
          ) : null}
          <button
            className={`btn wide ${result.passed ? "" : "ghost"}`}
            onClick={() => {
              router.push(backHref);
              router.refresh();
            }}
          >
            {result.passed ? t("continue") : personal ? t("backToTrail") : t("backHome")}
          </button>
        </div>
      </div>
    );
  }

  if (!exercise) return null;

  const currentAnswer = (): Answer => {
    if (exercise.kind === "intro") return null;
    if (exercise.kind === "order") return built;
    if (exercise.kind === "type") return text;
    return selected;
  };
  const ready =
    exercise.kind === "intro" ||
    (exercise.kind === "order"
      ? built.length > 0
      : exercise.kind === "type"
        ? text.trim().length > 1
        : selected !== null);
  const locked = phase !== "ask";

  const check = () => {
    if (!ready) return;
    const answer = currentAnswer();
    setAnswers((current) => [...current, answer]);
    const right = gradeAnswer(exercise, answer);
    if (exercise.kind !== "intro") playSound(right ? "right" : "wrong");
    setPhase(right ? "right" : "wrong");
  };

  const next = () => {
    if (position + 1 < view.exercises.length) {
      setPosition(position + 1);
      setPhase("ask");
      setSelected(null);
      setBuilt([]);
      setText("");
      window.scrollTo(0, 0);
      return;
    }
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    setElapsed(seconds);
    startTransition(async () => {
      const outcome = personal
        ? await completePersonalLessonAction({
            episodeId: view.episodeId,
            nodeIndex: view.nodeIndex,
            seed: view.seed,
            answers,
          })
        : await completeLessonAction({
            episodeId: view.episodeId,
            nodeIndex: view.nodeIndex,
            seed: view.seed,
            answers,
            seconds,
          });
      if (outcome.ok) setResult(outcome.data);
      else toast(outcome.message);
    });
  };

  const option = (label: string, index: number, answer: number) => {
    const state = locked
      ? index === answer
        ? "ok"
        : index === selected
          ? "no"
          : ""
      : selected === index
        ? "sel"
        : "";
    return (
      <button
        key={index}
        className={`opt ${state}`}
        onClick={() => {
          playSound("select");
          setSelected(index);
        }}
        disabled={locked}
      >
        <span className="k">{index + 1}</span>
        {label}
      </button>
    );
  };

  let body: React.ReactNode = null;
  if (exercise.kind === "intro") {
    body = (
      <>
        <span className="eyebrow">
          {view.title} · {view.level}
        </span>
        <div className="cuebox">
          <div className="tcode">
            <span>{personal ? null : formatTimecode(exercise.startMs)}</span>
            <span>{view.title}</span>
          </div>
          <div className="line">{exercise.english}</div>
        </div>
        <div className="intro">
          <SpeakButtons cueId={exercise.cueId} kind={speechKind} speech={speech} />
          {exercise.portuguese ? <div className="pt">{exercise.portuguese}</div> : null}
        </div>
      </>
    );
  } else if (exercise.kind === "choice") {
    body = (
      <>
        <div className="prompt">{t(`prompts.${exercise.prompt}`)}</div>
        <div className="cuebox">
          <div className="tcode">
            <span>{personal ? null : formatTimecode(exercise.startMs)}</span>
            <button
              onClick={() => speech.play(speechKind, exercise.cueId)}
              style={{ color: "#8A90A8", display: "flex", gap: 4, alignItems: "center" }}
            >
              <SoundIcon width={16} height={16} />
              {t("listen")}
            </button>
          </div>
          <div className="line">{exercise.english}</div>
        </div>
        <div className="opts">
          {exercise.options.map((label, index) => option(label, index, exercise.answer))}
        </div>
      </>
    );
  } else if (exercise.kind === "listen") {
    body = (
      <>
        <div className="prompt">{t(`prompts.${exercise.prompt}`)}</div>
        <div className="cuebox">
          <div className="tcode">
            <span>{t("hiddenSubtitle")}</span>
            <span>{personal ? null : formatTimecode(exercise.startMs)}</span>
          </div>
          <SpeakButtons cueId={exercise.cueId} kind={speechKind} speech={speech} big />
        </div>
        <div className="opts">
          {exercise.options.map((label, index) => option(label, index, exercise.answer))}
        </div>
      </>
    );
  } else if (exercise.kind === "blank") {
    body = (
      <>
        <div className="prompt">{t(`prompts.${exercise.prompt}`)}</div>
        <div className="cuebox">
          <div className="line" style={{ color: "#fff" }}>
            {exercise.before}{" "}
            {selected !== null ? (
              <b style={{ color: "var(--cue)", borderBottom: "3px solid var(--cue)", padding: "0 4px" }}>
                {exercise.options[selected]}
              </b>
            ) : (
              <span style={{ display: "inline-block", minWidth: 70, borderBottom: "3px dashed #8A90A8" }}>
                &nbsp;
              </span>
            )}
            {exercise.after}
          </div>
        </div>
        {exercise.hint ? (
          <div className="hint">
            <span>
              <b>{t("nativeTag")}</b> {exercise.hint}
            </span>
          </div>
        ) : null}
        <div className="opts">
          {exercise.options.map((label, index) => option(label, index, exercise.answer))}
        </div>
      </>
    );
  } else if (exercise.kind === "order") {
    body = (
      <>
        <div className="prompt">{t(`prompts.${exercise.prompt}`)}</div>
        {exercise.hint ? (
          <div className="hint">
            <span>
              <b>{t("nativeTag")}</b> {exercise.hint}
            </span>
          </div>
        ) : (
          <SpeakButtons cueId={exercise.cueId} kind={speechKind} speech={speech} big />
        )}
        <div className="answerline">
          {built.map((bankIndex) => (
            <button
              key={bankIndex}
              className="tok in"
              disabled={locked}
              onClick={() => {
                playSound("select");
                setBuilt((current) => current.filter((index) => index !== bankIndex));
              }}
            >
              {exercise.bank[bankIndex]}
            </button>
          ))}
        </div>
        <div className="bank">
          {exercise.bank.map((token, index) => {
            const used = built.includes(index);
            return (
              <button
                key={index}
                className={`tok ${used ? "used" : ""}`}
                disabled={used || locked}
                onClick={() => {
                  playSound("select");
                  setBuilt((current) => [...current, index]);
                }}
              >
                {token}
              </button>
            );
          })}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="prompt">{t(`prompts.${exercise.prompt}`)}</div>
        {exercise.hint ? (
          <div className="cuebox">
            <div className="line" style={{ color: "#fff" }}>
              {exercise.hint}
            </div>
          </div>
        ) : (
          <SpeakButtons cueId={exercise.cueId} kind={speechKind} speech={speech} big />
        )}
        <textarea
          className="ta"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("typeTarget")}
          disabled={locked}
          autoCapitalize="off"
          spellCheck={false}
          aria-label={t("yourAnswer")}
        />
      </>
    );
  }

  return (
    <div className="lesson">
      <div className="lhead">
        <button
          className="iconbtn"
          onClick={() => (inProgress ? setConfirmingExit(true) : exit())}
          aria-label={t("exit")}
        >
          <XIcon />
        </button>
        <div className="bar">
          <i style={{ width: `${(position / view.exercises.length) * 100}%` }} />
        </div>
        <span className="lvlchip">{view.level}</span>
      </div>
      {confirmingExit ? (
        <Sheet label={t("exitTitle")} onClose={() => setConfirmingExit(false)}>
          <h2 style={{ fontSize: 22 }}>{t("exitTitle")}</h2>
          <p className="muted">{t("exitBody")}</p>
          <button className="btn wide" onClick={() => setConfirmingExit(false)}>
            {t("exitStay")}
          </button>
          <button className="btn wide ghost" onClick={exit}>
            {t("exitConfirm")}
          </button>
        </Sheet>
      ) : null}
      <div className="lbody">{body}</div>
      {phase === "ask" ? (
        <div className="lfoot">
          <button className="btn wide" onClick={check} disabled={!ready}>
            {exercise.kind === "intro" ? t("gotIt") : t("check")}
          </button>
        </div>
      ) : (
        <div className={`lfoot ${phase === "right" ? "ok" : "no"}`}>
          <div className="fb">
            <h3>
              {phase === "right" ? <CheckIcon /> : <XIcon />}
              {phase === "right"
                ? exercise.kind === "intro"
                  ? t("letsPractice")
                  : t(`praise.${position % PRAISE_COUNT}`)
                : t("almost")}
            </h3>
            {phase === "wrong" ? (
              <p>
                <b>{t("answer")}</b> {correctAnswerText(exercise)}
              </p>
            ) : null}
          </div>
          <button
            className={`btn wide ${phase === "right" ? "good" : "bad"}`}
            onClick={next}
            disabled={pending}
          >
            {pending ? t("saving") : t("continue")}
          </button>
        </div>
      )}
    </div>
  );
}
