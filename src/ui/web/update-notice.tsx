"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const ACTIVATE = "activate";

let updateRequested = false;

export function WebUpdateNotice() {
  const t = useTranslations("web");
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const onControllerChange = () => {
      if (!updateRequested) return;
      updateRequested = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const offer = (worker: ServiceWorker | null) => {
          if (worker && navigator.serviceWorker.controller) setWaiting(worker);
        };
        offer(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed") offer(installing);
          });
        });
      })
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div
      className="toast show"
      role="status"
      style={{ display: "flex", gap: 10, alignItems: "center", pointerEvents: "auto" }}
    >
      <span className="small">{t("updateReady")}</span>
      <button
        type="button"
        className="btn sm"
        onClick={() => {
          updateRequested = true;
          waiting.postMessage(ACTIVATE);
        }}
      >
        {t("updateNow")}
      </button>
    </div>
  );
}
