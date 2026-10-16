"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckIcon, RedoIcon } from "../icons";
import { RecapLabelText, type RecapLabelView } from "./recap-label";

export type RecapListItem = {
  id: string;
  workTitle: string;
  label: RecapLabelView;
  title: string;
  step: number;
  steps: number;
  due: boolean;
  inDays: number;
};

export function RecapList({ items }: { items: RecapListItem[] }) {
  const t = useTranslations("recap");
  return (
    <>
      <p className="small muted">{t("intro")}</p>
      {items.length === 0 ? (
        <div
          className="card col"
          style={{ alignItems: "center", textAlign: "center", gap: 10, padding: "24px 16px" }}
        >
          <div style={{ width: 48, height: 48, color: "var(--good)" }}>
            <CheckIcon />
          </div>
          <p className="muted">{t("empty")}</p>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {items.map((item) => (
            <Link key={item.id} className={`recapitem ${item.due ? "due" : ""}`} href={`/recap/${item.id}`}>
              <span className="rn">
                <RedoIcon />
              </span>
              <span className="col" style={{ gap: 2, minWidth: 0 }}>
                <b className="small">{item.workTitle}</b>
                <span className="small muted">
                  <RecapLabelText label={item.label} /> · {item.title}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="steps" aria-label={t("stepOf", { step: item.step, total: item.steps })}>
                    {Array.from({ length: item.steps }, (_, index) => (
                      <i key={index} className={index < item.step ? "on" : ""} />
                    ))}
                  </span>
                  <span className={`chip ${item.due ? "brand" : ""}`}>
                    {item.due ? t("dueNow") : t("dueIn", { days: item.inDays })}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
