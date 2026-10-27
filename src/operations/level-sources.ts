import { z } from "zod";
import { AppError } from "@/shared/errors";
import { operation } from "./operation";

export const levelSourceOperations = {
  "levelSources.add": operation({
    input: z.unknown(),
    refresh: true,
    run: async ({ user, app, schedule }, input) => {
      const parsed = z.object({ url: z.string().max(4096) }).safeParse(input);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "levelSourceUrlInvalid");
      const result = await app.addLevelSource({
        actor: { userId: user.id, isAdmin: user.isAdmin },
        url: parsed.data.url,
      });
      await schedule("level_sources_sync", { sourceId: result.sourceId });
      return result;
    },
  }),
  "levelSources.sync": operation({
    input: z.undefined(),
    refresh: true,
    run: async ({ user, app, schedule }) => {
      await app.listLevelSources({ actor: { userId: user.id, isAdmin: user.isAdmin } });
      return schedule("level_sources_sync", { sourceId: null });
    },
  }),
  "levelSources.setEnabled": operation({
    input: z.object({ sourceId: z.uuid(), enabled: z.boolean() }),
    refresh: true,
    run: async ({ user, app }, input) => {
      await app.setLevelSourceEnabled({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...input });
      return null;
    },
  }),
  "levelSources.remove": operation({
    input: z.object({ sourceId: z.uuid() }),
    refresh: true,
    run: async ({ user, app }, input) => {
      await app.removeLevelSource({ actor: { userId: user.id, isAdmin: user.isAdmin }, ...input });
      return null;
    },
  }),
};
