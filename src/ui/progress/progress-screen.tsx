import { CEFR_LEVELS, LEVEL_NAMES, levelIndex, nextLevel, type CefrLevel } from "@/shared/levels";
import { BoltIcon, FlameIcon, Icon, LockIcon, QuoteIcon, TargetIcon, type IconName } from "../icons";

export type ProgressView = {
  level: CefrLevel;
  levelPct: number;
  nextStep: string;
  streak: number;
  longest: number;
  totalXp: number;
  learned: number;
  accuracy: number;
  dailyGoal: number;
  goalMet: boolean;
  weekly: number[];
  heat: string;
  skills: { name: string; percent: number }[];
  achievements: { id: string; title: string; detail: string; icon: IconName; unlocked: boolean }[];
};

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const HEAT_TITLES = ["sem estudo", "meta parcial", "meta cumprida", "meta + bônus"];
const TODAY = 6;
const number = new Intl.NumberFormat("pt-BR");

export function ProgressScreen({ view }: { view: ProgressView }) {
  const current = levelIndex(view.level);
  const upcoming = nextLevel(view.level);
  const highest = Math.max(...view.weekly, view.dailyGoal, 1);
  const heat = [...view.heat].map(Number);
  const unlocked = view.achievements.filter((achievement) => achievement.unlocked).length;

  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>Progresso</h1>
      <section className="card col" style={{ gap: 14 }}>
        <div className="sec-h">
          <div className="col" style={{ gap: 2 }}>
            <span className="eyebrow">Seu nível (QECR)</span>
            <h2 style={{ fontSize: 22 }}>
              {view.level} · {LEVEL_NAMES[view.level]}
            </h2>
          </div>
          <span className="small muted mono">
            {view.levelPct}% até {upcoming ?? "—"}
          </span>
        </div>
        <div className="ladder">
          {CEFR_LEVELS.map((level, index) => (
            <div key={level} className={`rung ${index < current ? "past" : index === current ? "now" : ""}`}>
              <div className="b" style={{ height: 24 + index * 14 }}>
                {index === current ? <i style={{ height: `${view.levelPct}%` }} /> : null}
              </div>
              <span>{level}</span>
            </div>
          ))}
        </div>
        <p className="small muted">{view.nextStep}</p>
      </section>
      <div className="tiles">
        <div className="tile">
          <FlameIcon />
          <div>
            <b>{view.streak} dias</b>
            <small>Sequência · recorde {view.longest}</small>
          </div>
        </div>
        <div className="tile">
          <BoltIcon />
          <div>
            <b>{number.format(view.totalXp)}</b>
            <small>XP total</small>
          </div>
        </div>
        <div className="tile" style={{ color: "var(--brand)" }}>
          <QuoteIcon />
          <div style={{ color: "var(--ink)" }}>
            <b>{number.format(view.learned)}</b>
            <small>Expressões aprendidas</small>
          </div>
        </div>
        <div className="tile" style={{ color: "var(--good)" }}>
          <TargetIcon />
          <div style={{ color: "var(--ink)" }}>
            <b>{view.accuracy}%</b>
            <small>Acertos (30 dias)</small>
          </div>
        </div>
      </div>
      <section className="card col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 17 }}>XP da semana</h2>
          <span className="small muted">meta {view.dailyGoal}/dia</span>
        </div>
        <div className="bars">
          {view.weekly.map((value, index) => (
            <div key={index} className={index === TODAY ? "today" : ""}>
              <em>{value}</em>
              <i style={{ height: `${Math.max(3, (value / highest) * 100 * 0.82)}%` }} />
            </div>
          ))}
        </div>
        <div className="barlbl">
          {DAYS.map((day, index) => (
            <span key={index} style={index === TODAY ? { color: "var(--brand)" } : undefined}>
              {index === TODAY ? "Hoje" : day}
            </span>
          ))}
        </div>
      </section>
      <section className="card col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 17 }}>Dias estudados</h2>
          <span className="small muted">últimas 5 semanas</span>
        </div>
        <div className="heat">
          {heat.map((level, index) => (
            <i key={index} className={`h${level}`} title={HEAT_TITLES[level]} />
          ))}
          <i className={`h${view.goalMet ? 3 : 1} today`} title="hoje" />
        </div>
      </section>
      <section className="card col" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 17 }}>Compreensão por habilidade</h2>
        {view.skills.map((skill) => (
          <div className="skill" key={skill.name}>
            <span>{skill.name}</span>
            <div className="bar">
              <i style={{ width: `${skill.percent}%` }} />
            </div>
            <b>{skill.percent}%</b>
          </div>
        ))}
      </section>
      <section className="col" style={{ gap: 10 }}>
        <div className="sec-h">
          <h2 style={{ fontSize: 18 }}>Conquistas</h2>
          <span className="small muted">
            {unlocked}/{view.achievements.length}
          </span>
        </div>
        <div className="achs">
          {view.achievements.map((achievement) => (
            <div key={achievement.id} className={`ach ${achievement.unlocked ? "" : "locked"}`}>
              <span className="medal">
                {achievement.unlocked ? <Icon name={achievement.icon} /> : <LockIcon />}
              </span>
              <b>{achievement.title}</b>
              <small>{achievement.detail}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
