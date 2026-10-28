import { z } from "zod";
import type { ComponentProps } from "react";
import type { TransferWork } from "@/ui/transfer/transfer-screen";
import { operation } from "../operation";
import type { TransferScreen } from "@/ui/transfer/transfer-screen";

export const transferView = {
  "view.transfer": operation({
    input: z.object({ mediaId: z.string().optional(), erro: z.string().optional() }),
    run: async (operationContext, input): Promise<ComponentProps<typeof TransferScreen>> => {
      const { app } = operationContext;

      const { mediaId, erro } = input;
      const works: TransferWork[] = [];
      for (const entry of await app.listCatalogWorks()) {
        const episodes = await app.listEpisodesByMedia(entry.id);
        const seasons = new Map<number, TransferWork["seasons"][number]>();
        for (const episode of episodes) {
          const season = seasons.get(episode.seasonNumber) ?? {
            seasonNumber: episode.seasonNumber,
            episodes: [],
          };
          season.episodes.push({
            id: episode.id,
            episodeNumber: episode.episodeNumber,
            title: episode.title,
            ready: episode.status === "READY",
          });
          seasons.set(episode.seasonNumber, season);
        }
        works.push({
          id: entry.id,
          title: entry.title,
          type: entry.type,
          seasons: [...seasons.values()].sort((a, b) => a.seasonNumber - b.seasonNumber),
        });
      }
      const selectedMediaId = works.some((work) => work.id === mediaId) ? (mediaId ?? null) : null;

      return {
        view: { works, selectedMediaId, passwordError: erro === "senha" },
      };
    },
  }),
};
