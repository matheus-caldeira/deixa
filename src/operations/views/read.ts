import { z } from "zod";
import type { ComponentProps } from "react";
import { voiceFor } from "@/modules/audio";
import { episodeLabel } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { LANGUAGE_TAGS } from "@/shared/study-languages";
import { defaultDisplayMode } from "@/shared/levels";
import { routes } from "@/shared/routes";
import { AppError } from "@/shared/errors";
import { operation } from "../operation";
import type { ReadScreen } from "@/ui/read/read-screen";

export const dynamic = "force-dynamic";

export const readView = {
  "view.read": operation({
    input: z.object({ id: z.string().optional(), batch: z.string().optional() }),
    run: async (
      operationContext,
      input,
    ): Promise<ComponentProps<typeof ReadScreen> & { viewKey: string }> => {
      const { user, app, translator } = operationContext;

      const { id: episodeId = "", batch } = input;
      if (!z.uuid().safeParse(episodeId).success) throw new AppError("MEDIA_NOT_FOUND");
      const context = await app.getEpisodeContext(episodeId);
      if (!context || context.episode.status !== "READY") throw new AppError("MEDIA_NOT_FOUND");
      const pair = pairOf(user.preferences);
      if (!context.episode.subtitleLanguages.includes(pair.target)) throw new AppError("MEDIA_NOT_FOUND");

      const [view, suggestions, origins, scriptCompletions, scriptSummary] = await Promise.all([
        app.getReadingView(user.id, episodeId, pair),
        app.listCatalogSuggestions(episodeId, pair.target),
        app.listSubtitleOrigins(episodeId),
        app.listScriptCompletions(episodeId, pair.target),
        app.getScriptSummary(episodeId, pair.target),
      ]);
      const t = await translator("read");
      const subtitleCredits = origins.flatMap(({ language, origin }) =>
        origin
          ? [
              [t("credit", { tag: LANGUAGE_TAGS[language] }), origin.releaseName, origin.author]
                .filter(Boolean)
                .join(" · "),
            ]
          : [],
      );
      if (scriptSummary) {
        subtitleCredits.push(
          t(scriptSummary.status === "VERIFIED" ? "scriptVerified" : "scriptNeedsReview", {
            matched: scriptSummary.matchedCount,
            total: scriptSummary.cueCount,
          }),
        );
      }
      const cachedAudioCueIds = await app.listCachedSpeech({
        voice: voiceFor(pair.target, user.preferences.preferredAccent),
        lines: view.lines.map((line) => ({ id: line.cueId, text: line.text })),
      });

      return {
        viewKey: `${episodeId}:${batch ?? ""}`,
        view: {
          episodeId,
          backHref: routes.work(context.media.id, context.season.seasonNumber),
          mediaTitle: context.media.title,
          label: episodeLabel(context.media.type, context.season.seasonNumber, context.episode.episodeNumber),
          episodeTitle: context.episode.title,
          hasNative: view.hasNative,
          pair,
          subtitleCredits,
          defaultMode: defaultDisplayMode(user.preferences.level),
          audioSpeed: user.preferences.audioSpeed,
          cachedAudioCueIds,
          openBatchId: batch && z.uuid().safeParse(batch).success ? batch : null,
          suggestions: suggestions.map(({ cueId, startToken, endToken, term }) => ({
            cueId,
            startToken,
            endToken,
            term,
          })),
          highlights: view.highlights.map((highlight) => ({
            cueId: highlight.cueId,
            startToken: highlight.startToken,
            endToken: highlight.endToken,
            kind: highlight.kind,
            carded: highlight.cardBatchId !== null,
          })),
          lines: view.lines.map((line) => ({
            cueId: line.cueId,
            startMs: line.startMs,
            tokens: line.tokens,
            sceneIndex: line.sceneIndex,
            startsScene: line.startsScene,
            translation: line.translation,
            translationSource: line.translationSource,
            markedByCount: line.markedByCount,
            scriptText: scriptCompletions.get(line.cueId) ?? null,
          })),
        },
      };
    },
  }),
};
