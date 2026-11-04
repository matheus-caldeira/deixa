import { z } from "zod";
import type { ComponentProps } from "react";
import type { AccountsScreen } from "@/ui/accounts/accounts-screen";
import { listAccountRows } from "../accounts";
import { operation, ViewRedirect } from "../operation";

const NON_ADMIN_TARGET = "/settings";

export const accountsView = {
  "view.accounts": operation({
    input: z.undefined(),
    run: async (context): Promise<ComponentProps<typeof AccountsScreen>> => {
      if (!context.user.isAdmin) throw new ViewRedirect(NON_ADMIN_TARGET);
      return { accounts: await listAccountRows(context) };
    },
  }),
};
