"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions/profile";
import type { AppSettings } from "@/modules/settings";
import { useToast } from "./toast";

export function ServerSettingsCard({ initial }: { initial: AppSettings }) {
  const t = useTranslations("serverSettings");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [customEndpoints, setCustomEndpoints] = useState(initial.aiCustomEndpointsAllowed);
  const [downloads, setDownloads] = useState(String(initial.subtitleDownloadsPerUserPerDay));
  const [kokoroUrl, setKokoroUrl] = useState(initial.kokoroUrl ?? "");
  const [error, setError] = useState("");

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await updateSettingsAction({
        aiGeneration: initial.aiGeneration,
        aiEmbedding: initial.aiEmbedding,
        aiCustomEndpointsAllowed: customEndpoints,
        subtitleDownloadsPerUserPerDay: Number(downloads),
        kokoroUrl: kokoroUrl.trim() === "" ? null : kokoroUrl.trim(),
        aiSharedLimit: initial.aiSharedLimit,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(t("saved"));
      router.refresh();
    });
  };

  return (
    <form className="col" style={{ gap: 10 }} onSubmit={save}>
      <div className="card col" style={{ gap: 10 }}>
        <div className="field">
          <label htmlFor="settings-downloads">{t("downloads")}</label>
          <input
            id="settings-downloads"
            value={downloads}
            onChange={(event) => setDownloads(event.target.value)}
            inputMode="numeric"
            required
          />
          <span className="small muted">{t("downloadsNote")}</span>
        </div>
        <div className="field">
          <label htmlFor="settings-kokoro">{t("kokoro")}</label>
          <input
            id="settings-kokoro"
            value={kokoroUrl}
            onChange={(event) => setKokoroUrl(event.target.value)}
            placeholder="http://localhost:1881"
            autoCapitalize="none"
            spellCheck={false}
          />
          <span className="small muted">{t("kokoroNote")}</span>
        </div>
        <div className="field">
          <label>{t("customEndpoints")}</label>
          <div className="seg" role="radiogroup" aria-label={t("customEndpoints")}>
            <button
              type="button"
              className={customEndpoints ? "" : "on"}
              onClick={() => setCustomEndpoints(false)}
            >
              {t("off")}
            </button>
            <button
              type="button"
              className={customEndpoints ? "on" : ""}
              onClick={() => setCustomEndpoints(true)}
            >
              {t("on")}
            </button>
          </div>
          <span className="small muted">{t("customEndpointsNote")}</span>
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button className="btn" style={{ padding: 12, fontSize: 13 }} type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
