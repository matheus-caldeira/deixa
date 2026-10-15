"use client";

import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { markNotificationReadAction, type InboxView } from "@/app/actions/notifications";
import { CheckIcon, SparkIcon, XIcon } from "../icons";
import { Sheet } from "./sheet";
import { useErrorText } from "./use-error-text";

export function NotificationsSheet(props: { inbox: InboxView; onChange: () => void; onClose: () => void }) {
  const t = useTranslations("inbox");
  const format = useFormatter();
  const errorText = useErrorText();
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

  const describe = (item: InboxView["items"][number]) => {
    const params = { ...item.params };
    if (typeof params.reason === "string") params.reason = errorText(params.reason);
    return {
      title: t.has(`${item.kind}.title`) ? t(`${item.kind}.title`, params) : item.kind,
      body: t.has(`${item.kind}.body`) ? t(`${item.kind}.body`, params) : "",
    };
  };

  return (
    <Sheet label={t("title")} onClose={props.onClose}>
      <div className="sec-h">
        <h2 style={{ fontSize: 22 }}>{t("title")}</h2>
        {props.inbox.unread > 0 ? (
          <button className="link" onClick={readAll}>
            {t("readAll")}
          </button>
        ) : null}
      </div>
      {props.inbox.items.length === 0 ? (
        <p className="muted">{t("empty")}</p>
      ) : (
        <div className="col">
          {props.inbox.items.map((item) => {
            const failed = item.kind.endsWith("_failed");
            const text = describe(item);
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
                  <b>{text.title}</b>
                  {text.body ? <span className="small muted">{text.body}</span> : null}
                  <span className="small muted mono">
                    {format.dateTime(new Date(item.createdAt), {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
