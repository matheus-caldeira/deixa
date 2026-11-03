import type { Clock } from "@/shared/clock";
import type { CefrLevel } from "@/shared/levels";
import type { StudyLanguage } from "@/shared/study-languages";
import { sameRange } from "../domain/level-ratings";
import { measureSubtitleLevel } from "../domain/subtitle-level";
import { makeResolveLevelRatings, type ResolveDeps } from "./level-sources";
import type { CatalogRepository, ReadEpisodeCues } from "./ports";

type Deps = ResolveDeps & {
  catalog: CatalogRepository;
  readCues: ReadEpisodeCues;
  clock: Clock;
};

export type EpisodeLevelOutcome =
  | { status: "measured"; level: CefrLevel; rangeUpdated: boolean }
  | { status: "skipped"; reason: "notReady" | "otherLanguage" | "tooShort" };

const TMDB = "tmdb";

export function makeMeasureEpisodeLevel(deps: Deps) {
  const resolve = makeResolveLevelRatings(deps);

  async function refreshWorkRange(media: {
    id: string;
    metadataProvider: string;
    externalId: string;
    levelMin: CefrLevel;
    levelMax: CefrLevel;
  }): Promise<boolean> {
    if (media.metadataProvider !== TMDB) return false;
    const range = (await resolve([media.externalId])).get(media.externalId)?.range;
    if (!range || sameRange(range, [media.levelMin, media.levelMax])) return false;
    await deps.catalog.updateLevelRange(media.id, range);
    return true;
  }

  return async function measureEpisodeLevel(input: {
    episodeId: string;
    language: StudyLanguage;
  }): Promise<EpisodeLevelOutcome> {
    const context = await deps.catalog.findEpisodeContext(input.episodeId);
    if (!context || context.episode.status !== "READY") return { status: "skipped", reason: "notReady" };
    if (context.media.originalLanguage !== input.language) {
      return { status: "skipped", reason: "otherLanguage" };
    }
    const cues = await deps.readCues(input.episodeId, input.language);
    const measurement = cues ? measureSubtitleLevel(cues, input.language) : null;
    if (!measurement) {
      await deps.measured.remove(input.episodeId);
      await refreshWorkRange(context.media);
      return { status: "skipped", reason: "tooShort" };
    }
    await deps.measured.save({
      episodeId: input.episodeId,
      mediaItemId: context.media.id,
      language: input.language,
      measurement,
      now: deps.clock.now(),
    });
    return {
      status: "measured",
      level: measurement.level,
      rangeUpdated: await refreshWorkRange(context.media),
    };
  };
}
