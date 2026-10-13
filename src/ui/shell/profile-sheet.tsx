"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";
import { updatePreferencesAction } from "@/app/actions/profile";
import { AUDIO_SPEEDS, DAILY_GOALS, type Accent } from "@/modules/identity";
import { APP_AUTHOR, APP_NAME, APP_TAGLINE, APP_VERSION } from "@/shared/app";
import type { CefrLevel } from "@/shared/levels";
import { LEVEL_NAMES } from "@/shared/levels";
import { SlidersIcon } from "../icons";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

export type ProfileSheetData = {
  name: string;
  avatarColor: string;
  level: CefrLevel;
  dailyGoal: number;
  accent: Accent;
  audioSpeed: number;
  metadataProvider: string;
};

const ACCENTS: { value: Accent; label: string }[] = [
  { value: "US", label: "Americano" },
  { value: "UK", label: "Britânico" },
];

export function ProfileSheet({ data, onClose }: { data: ProfileSheetData; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [goal, setGoal] = useState(data.dailyGoal);
  const [accent, setAccent] = useState(data.accent);
  const [speed, setSpeed] = useState(data.audioSpeed);

  const save = (patch: { dailyGoal?: number; preferredAccent?: Accent; audioSpeed?: number }) =>
    startTransition(async () => {
      const result = await updatePreferencesAction(patch);
      if (!result.ok) toast(result.message);
      router.refresh();
    });

  return (
    <Sheet label="Perfil e configurações" onClose={onClose}>
      <div className="row">
        <span
          className="avatar"
          style={{ background: data.avatarColor, width: 52, height: 52, fontSize: 22 }}
        >
          {data.name.slice(0, 1)}
        </span>
        <div className="col" style={{ gap: 2 }}>
          <h2 style={{ fontSize: 22 }}>{data.name}</h2>
          <span className="small muted">
            {data.level} · {LEVEL_NAMES[data.level]}
          </span>
        </div>
      </div>

      <div className="field">
        <label>Meta diária</label>
        <div className="seg">
          {DAILY_GOALS.map((option) => (
            <button
              key={option.xp}
              className={goal === option.xp ? "on" : ""}
              onClick={() => {
                setGoal(option.xp);
                save({ dailyGoal: option.xp });
              }}
            >
              {option.label}
              <br />
              <span className="mono small">{option.xp} XP</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Sotaque preferido do áudio</label>
        <div className="seg">
          {ACCENTS.map((option) => (
            <button
              key={option.value}
              className={accent === option.value ? "on" : ""}
              onClick={() => {
                setAccent(option.value);
                save({ preferredAccent: option.value });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Velocidade do áudio</label>
        <div className="seg">
          {AUDIO_SPEEDS.map((option) => (
            <button
              key={option}
              className={speed === option ? "on" : ""}
              onClick={() => {
                setSpeed(option);
                save({ audioSpeed: option });
              }}
            >
              {String(option).replace(".", ",")}×
            </button>
          ))}
        </div>
      </div>

      <Link className="btn ghost wide" href="/settings" onClick={onClose}>
        <SlidersIcon width={18} height={18} /> Configurações
      </Link>

      <form action={signOutAction}>
        <button className="btn ghost wide" type="submit">
          Trocar de perfil
        </button>
      </form>

      <div className="about">
        <span className="eyebrow">Sobre</span>
        <span>
          <b>{APP_NAME}</b> {APP_VERSION} · {APP_TAGLINE}
        </span>
        <span>
          Criado por <b>{APP_AUTHOR.name}</b>. Contato:{" "}
          <a className="link" href={`mailto:${APP_AUTHOR.email}`}>
            {APP_AUTHOR.email}
          </a>{" "}
          ·{" "}
          <a className="link" href={`tel:${APP_AUTHOR.phoneHref}`}>
            {APP_AUTHOR.phone}
          </a>
        </span>
        <span>
          Metadados de séries e filmes: <b>TMDB</b>
          {data.metadataProvider === "tmdb" ? "" : " (dados de demonstração neste ambiente)"}
        </span>
        <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
        <span>
          Legendas buscadas a pedido: <b>OpenSubtitles</b> (opensubtitles.com). Cada legenda mostra o release
          e quem enviou.
        </span>
      </div>
    </Sheet>
  );
}
