"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { CefrLevel } from "@/shared/levels";
import { BackIcon, BoltIcon, FlameIcon, FlameOffIcon } from "../icons";

export type PersonRow = {
  id: string;
  name: string;
  avatarColor: string;
  level: CefrLevel;
  streak: number;
  totalXp: number;
  xpToday: number;
  isYou: boolean;
};

export function PeopleScreen({ people }: { people: PersonRow[] }) {
  const t = useTranslations("people");
  const levels = useTranslations("levels");
  const format = useFormatter();
  return (
    <>
      <Link className="back" href="/">
        <BackIcon /> {t("home")}
      </Link>
      <h1 style={{ fontSize: 28 }}>{t("title")}</h1>
      <p className="muted">{t("intro")}</p>
      <section className="card" style={{ padding: "4px 16px" }}>
        {people.map((person) => (
          <div className="ep" style={{ gridTemplateColumns: "44px 1fr auto" }} key={person.id}>
            <span className="avatar" style={{ background: person.avatarColor, width: 44, height: 44 }}>
              {person.name.slice(0, 1)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="t">
                {person.name}
                {person.isYou ? (
                  <span className="chip brand" style={{ marginLeft: 8 }}>
                    {t("you")}
                  </span>
                ) : null}
              </div>
              <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span className="lvlchip">{person.level}</span>
                <span className="small muted">{levels(person.level)}</span>
              </div>
            </div>
            <div className="col" style={{ gap: 4, alignItems: "flex-end" }}>
              <span className="stat" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
                {person.streak > 0 ? <FlameIcon /> : <FlameOffIcon />}
                {t("days", { count: person.streak })}
              </span>
              <span className="stat" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
                <BoltIcon />
                {format.number(person.totalXp)} XP
              </span>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
