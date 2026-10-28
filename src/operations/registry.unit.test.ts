import { describe, expect, it } from "vitest";
import { z } from "zod";
import { execute, operation, type OperationContext } from "./operation";
import { OPERATION_GROUPS, OPERATIONS } from "./registry";

describe("registro de operações", () => {
  it("junta todos os grupos sem repetir nome", () => {
    const total = OPERATION_GROUPS.reduce((sum, group) => sum + Object.keys(group).length, 0);
    expect(Object.keys(OPERATIONS)).toHaveLength(total);
  });

  it("recusa entrada fora do schema antes de chamar o caso de uso", async () => {
    let called = false;
    const probe = operation({
      input: z.object({ id: z.uuid() }),
      run: async () => {
        called = true;
        return null;
      },
    });
    await expect(execute(probe, {} as OperationContext, { id: "x" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(called).toBe(false);
  });
});
