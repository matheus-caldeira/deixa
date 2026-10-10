"use client";

import type { CefrLevel } from "@/shared/levels";
import { levelIndex } from "@/shared/levels";
import { BackIcon, Icon, KeyIcon, MicIcon, type IconName } from "../icons";
import { useShell } from "../shell/app-shell";
import { useToast } from "../shell/toast";

export type ScenarioView = { id: string; icon: IconName; title: string; level: CefrLevel; detail: string };

export function TalkScreen(props: { scenarios: ScenarioView[]; userLevel: CefrLevel; hasKey: boolean }) {
  const toast = useToast();
  const { openProfile } = useShell();
  const user = levelIndex(props.userLevel);
  const sorted = [...props.scenarios].sort(
    (a, b) => Math.abs(levelIndex(a.level) - user) - Math.abs(levelIndex(b.level) - user),
  );

  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>Conversar</h1>
      <p className="muted">
        Pratique situações reais com um tutor de IA. Ele corrige suas frases e transforma os erros em cartões
        de revisão.
      </p>
      {props.hasKey ? null : (
        <div className="hint" style={{ flexDirection: "column", gap: 8 }}>
          <span>
            <b>Configure sua chave do Google AI</b> para conversar com o tutor. Revisões e flashcards
            continuam funcionando sem ela.
          </span>
          <button
            className="btn cue"
            style={{ alignSelf: "flex-start", padding: "10px 14px", fontSize: 13 }}
            onClick={openProfile}
          >
            <KeyIcon width={18} height={18} /> Adicionar chave
          </button>
        </div>
      )}
      <section className="card" style={{ padding: "4px 16px" }}>
        {sorted.map((scenario) => {
          const distance = levelIndex(scenario.level) - user;
          return (
            <div className="ep" style={{ gridTemplateColumns: "1fr" }} key={scenario.id}>
              <button className="scen" onClick={() => toast("O tutor por texto chega numa próxima fase.")}>
                <span className="ic">
                  <Icon name={scenario.icon} />
                </span>
                <span className="col" style={{ gap: 3, minWidth: 0 }}>
                  <b>{scenario.title}</b>
                  <span className="small muted">{scenario.detail}</span>
                  <span className="row" style={{ gap: 6 }}>
                    {distance === 0 ? (
                      <span className="chip good">Recomendado</span>
                    ) : distance > 0 ? (
                      <span className="chip warn">Desafio</span>
                    ) : (
                      <span className="chip">Revisão</span>
                    )}
                    <span className="chip mono">{scenario.level}</span>
                  </span>
                </span>
                <span style={{ color: "var(--muted)", width: 20, transform: "rotate(180deg)" }}>
                  <BackIcon />
                </span>
              </button>
            </div>
          );
        })}
      </section>
      <section className="card row" style={{ opacity: 0.75 }}>
        <span className="scen" style={{ gridTemplateColumns: "48px 1fr" }}>
          <span className="ic">
            <MicIcon />
          </span>
          <span className="col" style={{ gap: 3 }}>
            <b>Chamada de voz com o tutor</b>
            <span className="small muted">
              Fase 2: fala em tempo real, transcrição e avaliação de pronúncia.
            </span>
          </span>
        </span>
        <span className="chip">Em breve</span>
      </section>
    </>
  );
}
