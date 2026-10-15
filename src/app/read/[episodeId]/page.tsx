import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { voiceFor } from "@/modules/audio";
import { episodeLabel } from "@/modules/catalog";
import { pairOf } from "@/modules/identity";
import { LANGUAGE_TAGS } from "@/shared/study-languages";
import { defaultDisplayMode } from "@/shared/levels";
import { ReadScreen } from "@/ui/read/read-screen";
import { ToastProvider } from "@/ui/shell/toast";
import { requireUser } from "../../session";

export const dynamic = "force-dynamic";

export default async function ReadPage(props: {
  params: Promise<{ episodeId: string }>;
  searchParams: Promise<{ batch?: string }>;
}) {
  const user = await requireUser();
  const { episodeId } = await props.params;
  const { batch } = await props.searchParams;
  if (!z.uuid().safeParse(episodeId).success) notFound();
  const container = getContainer();
  const context = await container.getEpisodeContext(episodeId);
  if (!context || context.episode.status !== "READY") notFound();
  const pair = pairOf(user.preferences);
  if (!context.episode.subtitleLanguages.includes(pair.target)) notFound();

  const [view, suggestions, origins] = await Promise.all([
    container.getReadingView(user.id, episodeId, pair),
    container.listCatalogSuggestions(episodeId, pair.target),
    container.listSubtitleOrigins(episodeId),
  ]);
  const t = await getTranslations("read");
  const subtitleCredits = origins.flatMap(({ language, origin }) =>
    origin
      ? [
          [t("credit", { tag: LANGUAGE_TAGS[language] }), origin.releaseName, origin.author]
            .filter(Boolean)
            .join(" · "),
        ]
      : [],
  );
  const cachedAudioCueIds = await container.listCachedSpeech({
    voice: voiceFor(pair.target, user.preferences.preferredAccent),
    lines: view.lines.map((line) => ({ id: line.cueId, text: line.text })),
  });

  return (
    <ToastProvider>
      <ReadScreen
        key={`${episodeId}:${batch ?? ""}`}
        view={{
          episodeId,
          backHref: `/catalog/${context.media.id}?season=${context.season.seasonNumber}`,
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
          })),
        }}
      />
    </ToastProvider>
  );
}
