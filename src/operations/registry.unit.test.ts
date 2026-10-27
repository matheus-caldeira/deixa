import { describe, expect, it } from "vitest";
import { z } from "zod";
import { aiSettingsOperations } from "./ai-settings";
import { catalogOperations } from "./catalog";
import { levelSourceOperations } from "./level-sources";
import { notificationOperations } from "./notifications";
import { execute, operation, type OperationContext } from "./operation";
import { personalSeriesOperations } from "./personal-series";
import { profileOperations } from "./profile";
import { readingOperations } from "./reading";
import { recommendationOperations } from "./recommendations";
import { OPERATIONS } from "./registry";
import { reviewOperations } from "./review";
import { studyOperations } from "./study";
import { transferOperations } from "./transfer";
import { tutorOperations } from "./tutor";

const GROUPS = [
  aiSettingsOperations,
  catalogOperations,
  levelSourceOperations,
  notificationOperations,
  personalSeriesOperations,
  profileOperations,
  readingOperations,
  recommendationOperations,
  reviewOperations,
  studyOperations,
  transferOperations,
  tutorOperations,
];

describe("registro de operações", () => {
  it("não repete nome entre grupos", () => {
    const total = GROUPS.reduce((sum, group) => sum + Object.keys(group).length, 0);
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
