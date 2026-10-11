"use client";

import { useRouter } from "next/navigation";
import { markNotificationReadAction, type InboxView } from "@/app/actions/notifications";
import { CheckIcon, SparkIcon, XIcon } from "../icons";
import { Sheet } from "./sheet";

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function NotificationsSheet(props: { inbox: InboxView; onChange: () => void; onClose: () => void }) {
  const router = useRouter();

  const open = async (item: InboxView["items"][number]) => {
    await markNotificationReadAction(item.id).catch(() => null);
    props.onChange();
    props.onClose();
    router.push(item.href);
  };

  const readAll = async () => {
    await markNotificationReadAction("all").catch(() => null);
    props.onChange();
  };

  return (
    <Sheet label="Notificações" onClose={props.onClose}>
      <div className="sec-h">
        <h2 style={{ fontSize: 22 }}>Notificações</h2>
        {props.inbox.unread > 0 ? (
          <button className="link" onClick={readAll}>
            Marcar todas como lidas
          </button>
        ) : null}
      </div>
      {props.inbox.items.length === 0 ? (
        <p className="muted">
          Nada por aqui. Quando seus cards ou uma trilha ficarem prontos, avisamos neste sino.
        </p>
      ) : (
        <div className="col">
          {props.inbox.items.map((item) => {
            const failed = item.kind.endsWith("_failed");
            return (
              <button key={item.id} className={`result ${item.read ? "" : "on"}`} onClick={() => open(item)}>
                <span
                  className="avatar"
                  style={{
                    width: 44,
                    height: 44,
                    background: failed ? "var(--bad-soft)" : "var(--cue-soft)",
                    color: failed ? "var(--bad)" : "var(--cue-deep)",
                  }}
                >
                  <span style={{ width: 22, height: 22, display: "grid" }}>
                    {failed ? <XIcon /> : item.kind === "cards_ready" ? <SparkIcon /> : <CheckIcon />}
                  </span>
                </span>
                <span className="col" style={{ gap: 2, minWidth: 0 }}>
                  <b>{item.title}</b>
                  {item.body ? <span className="small muted">{item.body}</span> : null}
                  <span className="small muted mono">{timeFormat.format(new Date(item.createdAt))}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
