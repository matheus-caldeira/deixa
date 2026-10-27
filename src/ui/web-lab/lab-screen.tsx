"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import type { RuntimeStatus } from "@/web/protocol";
import { runtime } from "@/web/runtime-client";

type Probe = { name: string | null; usage: number; quota: number };
const BYTES_PER_MB = 1_048_576;

export function LabScreen() {
  const t = useTranslations("webLab");
  const [status, setStatus] = useState<RuntimeStatus>({ state: "waiting" });
  const [probe, setProbe] = useState<Probe | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const status = (await runtime().call("auth.status")) as { user: { name: string } | null };
      const estimate = await navigator.storage.estimate();
      setProbe({ name: status.user?.name ?? null, usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "");
    }
  }, []);

  useEffect(
    () =>
      runtime().onStatus((next) => {
        setStatus(next);
        if (next.state === "ready") void refresh();
      }),
    [refresh],
  );

  const add = async () => {
    try {
      await runtime().call("auth.signUp", {
        name: "Prova",
        email: `prova-${Date.now()}@deixa.local`,
        password: "segredo123",
        level: "A2",
        nativeLanguage: "pt-BR",
        targetLanguage: "en",
        locale: "pt-BR",
      });
      await refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "");
    }
  };

  return (
    <section className="col" style={{ gap: 12, paddingTop: 12 }}>
      <h1 style={{ fontSize: 24 }}>{t("title")}</h1>
      <p data-testid="lab-status">{t(`status.${status.state}`)}</p>
      {status.state === "ready" ? (
        <p className="small muted" data-testid="lab-timing">
          {t("timing", { open: status.openMs, migrate: status.migrateMs })}
        </p>
      ) : null}
      {status.state === "failed" ? <p className="formerr">{status.reason}</p> : null}
      {probe ? (
        <p data-testid="lab-probe">
          {t("probe", {
            name: probe.name ?? "-",
            usage: Math.round(probe.usage / BYTES_PER_MB),
            quota: Math.round(probe.quota / BYTES_PER_MB),
          })}
        </p>
      ) : null}
      {error ? <p className="formerr">{error}</p> : null}
      <button className="btn" type="button" onClick={add} disabled={status.state !== "ready"}>
        {t("add")}
      </button>
      <nav className="row" style={{ gap: 8 }}>
        {["a", "b", "c"].map((id) => (
          <Link key={id} className="btn ghost sm" href={`/lab/detail?id=${id}`}>
            {t("detailLink", { id })}
          </Link>
        ))}
      </nav>
    </section>
  );
}

export function LabDetailScreen() {
  const t = useTranslations("webLab");
  const id = useSearchParams().get("id") ?? "";
  return (
    <section className="col" style={{ gap: 12, paddingTop: 12 }}>
      <h1 style={{ fontSize: 24 }} data-testid="lab-detail">
        {t("detail", { id })}
      </h1>
      <Link className="btn ghost sm" href="/lab">
        {t("back")}
      </Link>
    </section>
  );
}
