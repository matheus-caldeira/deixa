"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
import { useToast } from "../shell/toast";
import { useSpeech } from "../shell/use-speech";

export type LessonScreenView = {
  episodeId: string;
  nodeIndex: number;
  title: string;
  level: string;
  replay: boolean;
  audioSpeed: number;
  exercises: Exercise[];
};

const PRAISE = ["Isso aí!", "Mandou bem!", "Perfeito!", "Na mosca!"];
type Phase = "ask" | "right" | "wrong";

function SpeakButtons(props: { cueId: string; big?: boolean; speech: ReturnType<typeof useSpeech> }) {
  const loading = props.speech.loadingId === props.cueId;
  return (
    <div className="row" style={{ gap: props.big ? 14 : 10 }}>
      <button
        className={`speak ${props.big ? "big" : ""}`}
        onClick={() => props.speech.play("cue", props.cueId)}
        aria-label="Ouvir"
        disabled={loading}
      >
        <SoundIcon />
        {loading ? <span className="small">gerando…</span> : null}
      </button>
      <button
        className="speak slow"
        onClick={() => props.speech.play("cue", props.cueId, true)}
        aria-label="Ouvir devagar"
      >
        <TurtleIcon />
      </button>
    </div>
  );
}

export function LessonScreen({ view }: { view: LessonScreenView }) {
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
  const startedAt = useRef(0);
  const speech = useSpeech({ speed: view.audioSpeed, onError: toast });
  const exercise = view.exercises[position];
  const backHref = "/";

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  if (view.exercises.length === 0) {
    return (
      <div className="lesson">
        <div className="done">
          <h1>Sem exercícios</h1>
          <p className="muted">
            Esta cena é curta demais para montar uma lição. Leia o episódio e marque o que não entendeu.
          </p>
          <Link className="btn" href={backHref}>
            Voltar
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
              CENA {view.nodeIndex + 1} · OK
            </text>
          </svg>
          <div className="col" style={{ gap: 6, alignItems: "center" }}>
            <h1>{result.accuracy === 100 ? "Cena perfeita!" : "Cena concluída!"}</h1>
            <p className="muted">
              {result.replay
                ? result.xp > 0
                  ? "Lição repetida: XP reduzido pela metade."
                  : "Lição repetida várias vezes hoje: sem XP desta vez."
                : `Episódio em ${result.progressPercent}%.`}
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
                Precisão
              </div>
              <div className="v">{result.accuracy}%</div>
            </div>
            <div className="dstat" style={{ borderColor: "var(--brand)" }}>
              <div className="h" style={{ background: "var(--brand)" }}>
                Tempo
              </div>
              <div className="v">
                {minutes}:{seconds}
              </div>
            </div>
          </div>
          {result.queuedForReview > 0 ? (
            <p className="small muted">
              {result.queuedForReview} fala(s) com erro foram para a fila de revisão.
            </p>
          ) : null}
        </div>
        <div className="lfoot">
          <button
            className="btn wide"
            onClick={() => {
              router.push(backHref);
              router.refresh();
            }}
          >
            Continuar
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
    setPhase(gradeAnswer(exercise, answer) ? "right" : "wrong");
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
      const outcome = await completeLessonAction({
        episodeId: view.episodeId,
        nodeIndex: view.nodeIndex,
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
      <button key={index} className={`opt ${state}`} onClick={() => setSelected(index)} disabled={locked}>
        <span className="k">{index + 1}</span>
        {label}
      </button>
    );
  };

  let body: React.ReactNode = null;
  if (exercise.kind === "intro") {
    body = (
      <>
        <span className="eyebrow">Fala da cena · {view.level}</span>
        <div className="cuebox">
          <div className="tcode">
            <span>{formatTimecode(exercise.startMs)}</span>
            <span>{view.title}</span>
          </div>
          <div className="line">{exercise.english}</div>
        </div>
        <div className="intro">
          <SpeakButtons cueId={exercise.cueId} speech={speech} />
          {exercise.portuguese ? <div className="pt">{exercise.portuguese}</div> : null}
        </div>
      </>
    );
  } else if (exercise.kind === "choice") {
    body = (
      <>
        <div className="prompt">{exercise.prompt}</div>
        <div className="cuebox">
          <div className="tcode">
            <span>{formatTimecode(exercise.startMs)}</span>
            <button
              onClick={() => speech.play("cue", exercise.cueId)}
              style={{ color: "#8A90A8", display: "flex", gap: 4, alignItems: "center" }}
            >
              <SoundIcon width={16} height={16} />
              ouvir
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
        <div className="prompt">{exercise.prompt}</div>
        <div className="cuebox">
          <div className="tcode">
            <span>legenda oculta</span>
            <span>{formatTimecode(exercise.startMs)}</span>
          </div>
          <SpeakButtons cueId={exercise.cueId} speech={speech} big />
        </div>
        <div className="opts">
          {exercise.options.map((label, index) => option(label, index, exercise.answer))}
        </div>
      </>
    );
  } else if (exercise.kind === "blank") {
    body = (
      <>
        <div className="prompt">{exercise.prompt}</div>
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
              <b>PT:</b> {exercise.hint}
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
        <div className="prompt">{exercise.prompt}</div>
        {exercise.hint ? (
          <div className="hint">
            <span>
              <b>PT:</b> {exercise.hint}
            </span>
          </div>
        ) : (
          <SpeakButtons cueId={exercise.cueId} speech={speech} big />
        )}
        <div className="answerline">
          {built.map((bankIndex) => (
            <button
              key={bankIndex}
              className="tok in"
              disabled={locked}
              onClick={() => setBuilt((current) => current.filter((index) => index !== bankIndex))}
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
                onClick={() => setBuilt((current) => [...current, index])}
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
        <div className="prompt">{exercise.prompt}</div>
        {exercise.hint ? (
          <div className="cuebox">
            <div className="line" style={{ color: "#fff" }}>
              {exercise.hint}
            </div>
          </div>
        ) : (
          <SpeakButtons cueId={exercise.cueId} speech={speech} big />
        )}
        <textarea
          className="ta"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Digite em inglês"
          disabled={locked}
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Sua resposta em inglês"
        />
      </>
    );
  }

  return (
    <div className="lesson">
      <div className="lhead">
        <Link className="iconbtn" href={backHref} aria-label="Sair da lição">
          <XIcon />
        </Link>
        <div className="bar">
          <i style={{ width: `${(position / view.exercises.length) * 100}%` }} />
        </div>
        <span className="lvlchip">{view.level}</span>
      </div>
      <div className="lbody">{body}</div>
      {phase === "ask" ? (
        <div className="lfoot">
          <button className="btn wide" onClick={check} disabled={!ready}>
            {exercise.kind === "intro" ? "Entendi" : "Verificar"}
          </button>
        </div>
      ) : (
        <div className={`lfoot ${phase === "right" ? "ok" : "no"}`}>
          <div className="fb">
            <h3>
              {phase === "right" ? <CheckIcon /> : <XIcon />}
              {phase === "right"
                ? exercise.kind === "intro"
                  ? "Vamos praticar"
                  : PRAISE[position % PRAISE.length]
                : "Quase!"}
            </h3>
            {phase === "wrong" ? (
              <p>
                <b>Resposta:</b> {correctAnswerText(exercise)}
              </p>
            ) : null}
          </div>
          <button
            className={`btn wide ${phase === "right" ? "good" : "bad"}`}
            onClick={next}
            disabled={pending}
          >
            {pending ? "Salvando…" : "Continuar"}
          </button>
        </div>
      )}
    </div>
  );
}
