import { AppError } from "@/shared/errors";

export type AccountActor = { userId: string; isAdmin: boolean };

export function assertAccountAdmin(actor: AccountActor): void {
  if (!actor.isAdmin) throw new AppError("FORBIDDEN", "adminOnlyAccounts");
}
