import { notFound } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { episodeLabel } from "@/modules/catalog";
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

  const [view, suggestions] = await Promise.all([
    container.getReadingView(user.id, episodeId),
    container.listCatalogSuggestions(episodeId),
  ]);
  const cachedAudioCueIds = await container.listCachedSpeech({
    accent: user.preferences.preferredAccent,
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
          hasPortuguese: view.hasPortuguese,
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
