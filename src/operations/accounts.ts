import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/modules/identity";
import { CEFR_LEVELS } from "@/shared/levels";
import { operation, type OperationContext } from "./operation";

const MAX_NAME_CHARS = 80;
const MAX_EMAIL_CHARS = 200;
const MAX_PASSWORD_CHARS = 200;

const accountTarget = z.object({ accountId: z.uuid() });
const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_CHARS);

const actorOf = ({ user }: OperationContext) => ({ userId: user.id, isAdmin: user.isAdmin });

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  isAdmin: boolean;
  isSelf: boolean;
  createdAt: string;
  lastActiveAt: string | null;
};

export const accountOperations = {
  "accounts.list": operation({
    input: z.undefined(),
    run: async (context): Promise<AccountRow[]> => {
      const accounts = await context.app.listAccounts({ actor: actorOf(context) });
      return accounts.map((account) => ({
        id: account.id,
        name: account.name,
        email: account.email,
        avatarColor: account.avatarColor,
        isAdmin: account.isAdmin,
        isSelf: account.id === context.user.id,
        createdAt: account.createdAt.toISOString(),
        lastActiveAt: account.lastActiveAt?.toISOString() ?? null,
      }));
    },
  }),
  "accounts.create": operation({
    input: z
      .object({
        name: z.string().trim().min(1).max(MAX_NAME_CHARS),
        email: z.string().max(MAX_EMAIL_CHARS),
        password: passwordSchema,
        level: z.enum(CEFR_LEVELS).optional(),
      })
      .strict(),
    refresh: true,
    run: async (context, input) =>
      context.app.createAccount({
        actor: actorOf(context),
        name: input.name,
        email: input.email,
        password: input.password,
        level: input.level ?? "A1",
        locale: context.user.preferences.locale,
      }),
  }),
  "accounts.setAdmin": operation({
    input: accountTarget.extend({ isAdmin: z.boolean() }).strict(),
    refresh: true,
    run: async (context, input) => {
      await context.app.setAccountAdmin({ actor: actorOf(context), ...input });
      return null;
    },
  }),
  "accounts.resetPassword": operation({
    input: accountTarget.extend({ password: passwordSchema }).strict(),
    refresh: true,
    run: async (context, input) => {
      await context.app.resetAccountPassword({ actor: actorOf(context), ...input });
      return null;
    },
  }),
  "accounts.remove": operation({
    input: accountTarget.strict(),
    refresh: true,
    run: async (context, input) => {
      await context.app.removeAccount({ actor: actorOf(context), ...input });
      return null;
    },
  }),
};
