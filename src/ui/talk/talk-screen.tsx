"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { startConversationAction } from "@/app/actions/tutor";
import { CUSTOM_THEME_ID, MAX_TOPIC_LENGTH } from "@/modules/conversations";
import { BackIcon, Icon, SparkIcon, type IconName } from "../icons";
import { useToast } from "../shell/toast";

export type ThemeView = { id: string; icon: IconName; title: string; detail: string };
export type RecentConversation = {
  id: string;
  title: string;
  turnCount: number;
  reviewed: boolean;
  score: number | null;
};

export function TalkScreen(props: { themes: ThemeView[]; recent: RecentConversation[]; simulated: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [topic, setTopic] = useState("");

  const start = (themeId: string, customTopic: string | null) =>
    startTransition(async () => {
      const result = await startConversationAction({ themeId, customTopic }).catch(() => null);
      if (result && !result.ok) toast(result.message);
    });

  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>Conversar</h1>
      <p className="muted">
        Escolha um tema e converse livremente com o tutor, por texto ou por áudio. Ele corrige na hora e,
        quando você quiser, avalia a conversa inteira.
      </p>
      {props.simulated ? (
        <div className="hint">
          <span>
            <b>Tutor simulado.</b> Sem chave do Google AI, as respostas são genéricas. Adicione a sua no
            perfil.
          </span>
        </div>
      ) : null}
      <section className="card" style={{ padding: "4px 16px" }}>
        {props.themes.map((theme) => (
          <div className="ep" style={{ gridTemplateColumns: "1fr" }} key={theme.id}>
            <button className="scen" onClick={() => start(theme.id, null)} disabled={pending}>
              <span className="ic">
                <Icon name={theme.icon} />
              </span>
              <span className="col" style={{ gap: 3, minWidth: 0 }}>
                <b>{theme.title}</b>
                <span className="small muted">{theme.detail}</span>
              </span>
              <span style={{ color: "var(--muted)", width: 20, transform: "rotate(180deg)" }}>
                <BackIcon />
              </span>
            </button>
          </div>
        ))}
      </section>
      <form
        className="card col"
        style={{ gap: 10 }}
        onSubmit={(event) => {
          event.preventDefault();
          start(CUSTOM_THEME_ID, topic);
        }}
      >
        <div className="row">
          <SparkIcon className="inline-icon" style={{ color: "var(--brand)" }} />
          <b>Outro assunto</b>
        </div>
        <div className="field">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            maxLength={MAX_TOPIC_LENGTH}
            placeholder="Ex.: futebol, meu cachorro, entrevista de emprego"
            aria-label="Assunto da conversa"
          />
        </div>
        <button className="btn" type="submit" disabled={pending || topic.trim().length < 2}>
          Conversar sobre isso
        </button>
      </form>
      {props.recent.length > 0 ? (
        <section className="col" style={{ gap: 10 }}>
          <div className="sec-h">
            <h2 style={{ fontSize: 18 }}>Conversas recentes</h2>
          </div>
          <div className="card" style={{ padding: "4px 16px" }}>
            {props.recent.map((conversation) => (
              <Link
                className="ep"
                style={{ gridTemplateColumns: "1fr auto" }}
                key={conversation.id}
                href={`/tutor/${conversation.id}`}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="t">{conversation.title}</div>
                  <span className="small muted">{conversation.turnCount} mensagens</span>
                </div>
                {conversation.reviewed ? (
                  <span className="chip good">Revisada · {conversation.score}</span>
                ) : (
                  <span className="chip">Em aberto</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
