"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";
import { removeApiKeyAction, saveApiKeyAction, updatePreferencesAction } from "@/app/actions/profile";
import { AUDIO_SPEEDS, DAILY_GOALS, type Accent } from "@/modules/identity";
import type { CefrLevel } from "@/shared/levels";
import { LEVEL_NAMES } from "@/shared/levels";
import { KeyIcon } from "../icons";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

export type ProfileSheetData = {
  name: string;
  avatarColor: string;
  level: CefrLevel;
  dailyGoal: number;
  accent: Accent;
  audioSpeed: number;
  maskedKey: string | null;
  metadataProvider: string;
};

const ACCENTS: { value: Accent; label: string }[] = [
  { value: "US", label: "Americano" },
  { value: "UK", label: "Britânico" },
];

export function ProfileSheet({ data, onClose }: { data: ProfileSheetData; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [goal, setGoal] = useState(data.dailyGoal);
  const [accent, setAccent] = useState(data.accent);
  const [speed, setSpeed] = useState(data.audioSpeed);
  const [maskedKey, setMaskedKey] = useState(data.maskedKey);
  const [keyInput, setKeyInput] = useState("");
  const [keyMessage, setKeyMessage] = useState<{ text: string; error: boolean } | null>(null);

  const save = (patch: { dailyGoal?: number; preferredAccent?: Accent; audioSpeed?: number }) =>
    startTransition(async () => {
      const result = await updatePreferencesAction(patch);
      if (!result.ok) toast(result.message);
      router.refresh();
    });

  const saveKey = () => {
    setKeyMessage({ text: "Testando com uma requisição curta…", error: false });
    startTransition(async () => {
      const result = await saveApiKeyAction(keyInput);
      if (!result.ok) {
        setKeyMessage({ text: result.message, error: true });
        return;
      }
      setMaskedKey(result.data.masked);
      setKeyInput("");
      setKeyMessage(null);
      toast("Chave válida e salva com criptografia.");
      router.refresh();
    });
  };

  const removeKey = () =>
    startTransition(async () => {
      const result = await removeApiKeyAction();
      if (!result.ok) {
        toast(result.message);
        return;
      }
      setMaskedKey(null);
      toast("Chave removida. Revisões continuam funcionando.");
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

      <div className="card col" style={{ gap: 10 }}>
        <div className="row">
          <KeyIcon width={22} height={22} />
          <b>Chave do Google AI (Gemini)</b>
        </div>
        {maskedKey ? (
          <>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="mono small">{maskedKey}</span>
              <span className="chip good">Conectada</span>
            </div>
            <p className="small muted">
              Guardada criptografada no servidor. Ela nunca volta para o navegador nem é compartilhada com
              outras contas.
            </p>
            <button
              className="btn ghost"
              style={{ padding: 10, fontSize: 13 }}
              onClick={removeKey}
              disabled={pending}
            >
              Remover chave
            </button>
          </>
        ) : (
          <>
            <p className="small muted">
              Usada para explicar o que você marca e, depois, pelo tutor. O uso pode gerar cobrança na sua
              conta Google. Sem ela, as explicações são simuladas e as revisões continuam funcionando.
            </p>
            <div className="field">
              <input
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                aria-label="Chave do Google AI"
              />
            </div>
            {keyMessage ? (
              <span className="small" style={{ color: keyMessage.error ? "var(--bad)" : "var(--muted)" }}>
                {keyMessage.text}
              </span>
            ) : null}
            <button
              className="btn"
              style={{ padding: 12, fontSize: 13 }}
              onClick={saveKey}
              disabled={pending || keyInput.trim() === ""}
            >
              Testar e salvar
            </button>
          </>
        )}
      </div>

      <form action={signOutAction}>
        <button className="btn ghost wide" type="submit">
          Trocar de perfil
        </button>
      </form>

      <div className="about">
        <span className="eyebrow">Sobre</span>
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
