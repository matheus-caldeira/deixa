"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions/profile";
import type { AppSettings } from "@/modules/settings";
import { useToast } from "./toast";

export function ServerSettingsCard({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [model, setModel] = useState(initial.geminiModel);
  const [downloads, setDownloads] = useState(String(initial.subtitleDownloadsPerUserPerDay));
  const [kokoroUrl, setKokoroUrl] = useState(initial.kokoroUrl ?? "");
  const [error, setError] = useState("");

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await updateSettingsAction({
        geminiModel: model.trim(),
        subtitleDownloadsPerUserPerDay: Number(downloads),
        kokoroUrl: kokoroUrl.trim() === "" ? null : kokoroUrl.trim(),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast("Configurações do servidor salvas.");
      router.refresh();
    });
  };

  return (
    <form className="col" style={{ gap: 10 }} onSubmit={save}>
      <span className="eyebrow">Configurações do servidor (administrador)</span>
      <div className="card col" style={{ gap: 10 }}>
        <div className="field">
          <label htmlFor="settings-model">Modelo do Gemini</label>
          <input
            id="settings-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="settings-downloads">Downloads de legenda por conta, por dia</label>
          <input
            id="settings-downloads"
            value={downloads}
            onChange={(event) => setDownloads(event.target.value)}
            inputMode="numeric"
            required
          />
          <span className="small muted">Vale para quem usa a chave global do OpenSubtitles.</span>
        </div>
        <div className="field">
          <label htmlFor="settings-kokoro">Endereço do Kokoro (voz)</label>
          <input
            id="settings-kokoro"
            value={kokoroUrl}
            onChange={(event) => setKokoroUrl(event.target.value)}
            placeholder="http://localhost:1881"
            autoCapitalize="none"
            spellCheck={false}
          />
          <span className="small muted">
            Só neste computador ou numa rede privada. Em branco, o áudio fica em silêncio.
          </span>
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button className="btn" style={{ padding: 12, fontSize: 13 }} type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
