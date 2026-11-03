"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  createAccountAction,
  removeAccountAction,
  resetAccountPasswordAction,
  setAccountAdminAction,
} from "@/app/actions/accounts";
import { MIN_PASSWORD_LENGTH } from "@/modules/identity";
import type { AccountRow } from "@/operations/accounts";
import { CEFR_LEVELS, type CefrLevel } from "@/shared/levels";
import { BackIcon, PlusIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";

type Outcome = { ok: true } | { ok: false; message: string };

function useAccountAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const run = (work: () => Promise<Outcome>, success: string, after?: () => void) =>
    startTransition(async () => {
      setError("");
      const result = await work();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(success);
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

function CreateAccountSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("accounts");
  const levels = useTranslations("levels");
  const { pending, error, run } = useAccountAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<CefrLevel>("A1");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    run(
      () => createAccountAction({ name, email, password, level }),
      t("created", { name: name.trim() }),
      onClose,
    );
  };

  return (
    <Sheet label={t("createTitle")} onClose={onClose}>
      <h2 style={{ fontSize: 22 }}>{t("createTitle")}</h2>
      <p className="small muted">{t("createIntro")}</p>
      <form className="col" style={{ gap: 12 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="account-name">{t("name")}</label>
          <input
            id="account-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="account-email">{t("email")}</label>
          <input
            id="account-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="account-password">{t("password")}</label>
          <input
            id="account-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            required
          />
          <span className="small muted">{t("passwordNote", { min: MIN_PASSWORD_LENGTH })}</span>
        </div>
        <div className="field">
          <label htmlFor="account-level">{t("level")}</label>
          <select
            id="account-level"
            value={level}
            onChange={(event) => setLevel(event.target.value as CefrLevel)}
          >
            {CEFR_LEVELS.map((option) => (
              <option key={option} value={option}>
                {option} · {levels(option)}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="formerr">{error}</p> : null}
        <button className="btn wide" type="submit" disabled={pending}>
          {t("create")}
        </button>
      </form>
    </Sheet>
  );
}

function ManageAccountSheet({ account, onClose }: { account: AccountRow; onClose: () => void }) {
  const t = useTranslations("accounts");
  const { pending, error, run } = useAccountAction();
  const [stage, setStage] = useState<"menu" | "password" | "remove">("menu");
  const [password, setPassword] = useState("");

  const toggleAdmin = () =>
    run(
      () => setAccountAdminAction({ accountId: account.id, isAdmin: !account.isAdmin }),
      account.isAdmin ? t("demoted", { name: account.name }) : t("promoted", { name: account.name }),
      onClose,
    );

  const resetPassword = (event: React.FormEvent) => {
    event.preventDefault();
    run(
      () => resetAccountPasswordAction({ accountId: account.id, password }),
      t("passwordReset", { name: account.name }),
      onClose,
    );
  };

  const remove = () =>
    run(() => removeAccountAction({ accountId: account.id }), t("removed", { name: account.name }), onClose);

  return (
    <Sheet label={t("manageTitle", { name: account.name })} onClose={onClose}>
      <div className="row">
        <span
          className="avatar"
          style={{ background: account.avatarColor, width: 52, height: 52, fontSize: 22 }}
        >
          {account.name.slice(0, 1)}
        </span>
        <div className="col" style={{ gap: 2, minWidth: 0 }}>
          <h2 style={{ fontSize: 22 }}>{account.name}</h2>
          <span className="small muted" style={{ wordBreak: "break-all" }}>
            {account.email}
          </span>
        </div>
      </div>

      {stage === "menu" ? (
        <div className="col" style={{ gap: 10 }}>
          <button type="button" className="btn ghost wide" disabled={pending} onClick={toggleAdmin}>
            {account.isAdmin ? t("demote") : t("promote")}
          </button>
          <button
            type="button"
            className="btn ghost wide"
            disabled={pending}
            onClick={() => setStage("password")}
          >
            {t("resetPassword")}
          </button>
          {account.isSelf ? (
            <p className="small muted">{t("selfNote")}</p>
          ) : (
            <button
              type="button"
              className="btn ghost wide"
              disabled={pending}
              onClick={() => setStage("remove")}
            >
              {t("remove")}
            </button>
          )}
        </div>
      ) : null}

      {stage === "password" ? (
        <form className="col" style={{ gap: 12 }} onSubmit={resetPassword}>
          <div className="field">
            <label htmlFor="account-new-password">{t("newPassword")}</label>
            <input
              id="account-new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              required
            />
            <span className="small muted">{t("resetNote", { min: MIN_PASSWORD_LENGTH })}</span>
          </div>
          <button className="btn wide" type="submit" disabled={pending}>
            {t("savePassword")}
          </button>
          <button type="button" className="btn ghost wide" onClick={() => setStage("menu")}>
            {t("cancel")}
          </button>
        </form>
      ) : null}

      {stage === "remove" ? (
        <div className="col" style={{ gap: 10 }}>
          <h3 style={{ fontSize: 18 }}>{t("removeTitle", { name: account.name })}</h3>
          <p className="muted">{t("removeBody")}</p>
          <button type="button" className="btn wide" onClick={() => setStage("menu")}>
            {t("keep")}
          </button>
          <button type="button" className="btn bad wide" disabled={pending} onClick={remove}>
            {t("confirmRemove")}
          </button>
        </div>
      ) : null}

      {error ? <p className="formerr">{error}</p> : null}
    </Sheet>
  );
}

export function AccountsScreen({ accounts }: { accounts: AccountRow[] }) {
  const t = useTranslations("accounts");
  const format = useFormatter();
  const [creating, setCreating] = useState(false);
  const [managedId, setManagedId] = useState<string | null>(null);
  const managed = accounts.find((account) => account.id === managedId) ?? null;
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "short" });

  return (
    <>
      <Link className="back" href="/settings?tab=server">
        <BackIcon /> {t("back")}
      </Link>
      <h1 style={{ fontSize: 28 }}>{t("title")}</h1>
      <p className="muted">{t("intro")}</p>
      <button type="button" className="btn wide" onClick={() => setCreating(true)}>
        <PlusIcon width={18} height={18} /> {t("createTitle")}
      </button>
      <section className="card" style={{ padding: "4px 16px" }} aria-label={t("listLabel")}>
        {accounts.map((account) => (
          <div
            className="ep"
            style={{ gridTemplateColumns: "44px 1fr auto" }}
            key={account.id}
            data-account={account.email}
          >
            <span className="avatar" style={{ background: account.avatarColor, width: 44, height: 44 }}>
              {account.name.slice(0, 1)}
            </span>
            <div className="col" style={{ gap: 3, minWidth: 0 }}>
              <div className="t row" style={{ gap: 6, flexWrap: "wrap" }}>
                {account.name}
                {account.isSelf ? <span className="chip brand">{t("you")}</span> : null}
                {account.isAdmin ? <span className="chip good">{t("admin")}</span> : null}
              </div>
              <span className="small muted" style={{ wordBreak: "break-all" }}>
                {account.email}
              </span>
              <span className="small muted">
                {t("since", { date: date(account.createdAt) })} ·{" "}
                {account.lastActiveAt
                  ? t("lastActive", { date: date(account.lastActiveAt) })
                  : t("neverActive")}
              </span>
            </div>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setManagedId(account.id)}
              aria-label={t("manageTitle", { name: account.name })}
            >
              {t("manage")}
            </button>
          </div>
        ))}
      </section>
      {creating ? <CreateAccountSheet onClose={() => setCreating(false)} /> : null}
      {managed ? <ManageAccountSheet account={managed} onClose={() => setManagedId(null)} /> : null}
    </>
  );
}
