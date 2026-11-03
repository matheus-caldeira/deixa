import { describe, expect, it } from "vitest";
import type { OperationContext } from "../operation";
import { execute, ViewRedirect } from "../operation";
import { accountsView } from "./accounts";

const listedAt = new Date("2026-11-03T12:00:00Z");

function contextFor(isAdmin: boolean, onList: () => void): OperationContext {
  return {
    user: { id: "admin-id", isAdmin },
    app: {
      listAccounts: async () => {
        onList();
        return [
          {
            id: "admin-id",
            name: "Matheus",
            email: "matheus@deixa.example",
            avatarColor: "#000",
            isAdmin: true,
            createdAt: listedAt,
            lastActiveAt: null,
          },
        ];
      },
    },
  } as unknown as OperationContext;
}

describe("view.accounts", () => {
  it("manda quem não é administrador para as configurações sem listar contas", async () => {
    let listed = false;
    const run = execute(accountsView["view.accounts"], contextFor(false, () => (listed = true)), undefined);
    await expect(run).rejects.toBeInstanceOf(ViewRedirect);
    await expect(run).rejects.toMatchObject({ href: "/settings" });
    expect(listed).toBe(false);
  });

  it("lista as contas para o administrador e marca a própria", async () => {
    const view = await execute(accountsView["view.accounts"], contextFor(true, () => undefined), undefined);
    expect(view).toEqual({
      accounts: [
        {
          id: "admin-id",
          name: "Matheus",
          email: "matheus@deixa.example",
          avatarColor: "#000",
          isAdmin: true,
          isSelf: true,
          createdAt: listedAt.toISOString(),
          lastActiveAt: null,
        },
      ],
    });
  });
});
