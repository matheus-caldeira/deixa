import Link from "next/link";
import { LEVEL_NAMES, type CefrLevel } from "@/shared/levels";
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

const number = new Intl.NumberFormat("pt-BR");

export function PeopleScreen({ people }: { people: PersonRow[] }) {
  return (
    <>
      <Link className="back" href="/">
        <BackIcon /> Início
      </Link>
      <h1 style={{ fontSize: 28 }}>Quem está estudando</h1>
      <p className="muted">
        Nível, dias de ofensiva e XP de cada conta. Marcações, cards e revisões continuam só de cada um.
      </p>
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
                    você
                  </span>
                ) : null}
              </div>
              <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <span className="lvlchip">{person.level}</span>
                <span className="small muted">{LEVEL_NAMES[person.level]}</span>
              </div>
            </div>
            <div className="col" style={{ gap: 4, alignItems: "flex-end" }}>
              <span className="stat" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
                {person.streak > 0 ? <FlameIcon /> : <FlameOffIcon />}
                {person.streak} {person.streak === 1 ? "dia" : "dias"}
              </span>
              <span className="stat" style={{ boxShadow: "none", background: "var(--surface-2)" }}>
                <BoltIcon />
                {number.format(person.totalXp)} XP
              </span>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
