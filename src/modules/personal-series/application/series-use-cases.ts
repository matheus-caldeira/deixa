import { AppError } from "@/shared/errors";
import type { Clock } from "@/shared/clock";
import type { IdGenerator } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair } from "@/shared/study-languages";
import {
  FRESH_EPISODE_MS,
  activeLevel,
  cleanSeriesName,
  episodeNodes,
  planPlacements,
  progressPercent,
  seriesDescriptionSchema,
  upcomingSeason,
  validLevel,
  type Episode,
  type EpisodeNode,
  type Season,
  type Series,
  type SeriesLevel,
} from "../domain/series";
import type { DescribeSeriesInput, EpisodeSource, LearnerHints, PersonalSeriesRepository } from "./ports";

export type SeriesDeps = {
  series: PersonalSeriesRepository;
  levelPercent: (userId: string) => Promise<number>;
  describe: (userId: string, input: DescribeSeriesInput) => Promise<unknown>;
  learnerHints: (userId: string, pair: LanguagePair) => Promise<LearnerHints>;
  clock: Clock;
  ids: IdGenerator;
};

type Learner = { userId: string; pair: LanguagePair; userLevel: CefrLevel };

export type SeasonView = Season & { episodes: (Episode & { progress: number; fresh: boolean })[] };
export type SeriesView = {
  series: Series;
  activeLevel: CefrLevel;
  seasons: SeasonView[];
  upcoming: { level: CefrLevel; percent: number; unlockAt: number; themes: string[] } | null;
};

async function activeSeasonOf(deps: SeriesDeps, input: Learner) {
  const series = await deps.series.ensureSeries({
    id: deps.ids.next(),
    userId: input.userId,
    pair: input.pair,
    startLevel: input.userLevel,
    now: deps.clock.now(),
  });
  const levelPct = await deps.levelPercent(input.userId);
  const level = activeLevel({ level: series.level, userLevel: input.userLevel, levelPct });
  const season = await deps.series.ensureSeason({
    id: deps.ids.next(),
    seriesId: series.id,
    level,
    now: deps.clock.now(),
  });
  return { series, season, levelPct };
}

export function makeGetPersonalSeries(deps: SeriesDeps) {
  return async function getPersonalSeries(input: Learner): Promise<SeriesView> {
    const { series, season, levelPct } = await activeSeasonOf(deps, input);
    const [seasons, episodes] = await Promise.all([
      deps.series.listSeasons(series.id),
      deps.series.listEpisodes(series.id),
    ]);
    const completed = await Promise.all(
      episodes.map(
        async (episode) => (await deps.series.findEpisode(input.userId, episode.id))?.completedNodes ?? [],
      ),
    );
    const now = deps.clock.now().getTime();
    const withProgress = episodes.map((episode, index) => {
      const progress = progressPercent(episode.cardCount, new Set(completed[index]));
      return {
        ...episode,
        progress,
        fresh: progress === 0 && now - episode.createdAt.getTime() < FRESH_EPISODE_MS,
      };
    });
    return {
      series,
      activeLevel: season.level,
      seasons: seasons.map((candidate) => ({
        ...candidate,
        episodes: withProgress.filter((episode) => episode.seasonId === candidate.id),
      })),
      upcoming: upcomingSeason({
        level: series.level,
        userLevel: input.userLevel,
        levelPct,
        seasons,
        episodes,
      }),
    };
  };
}

export function makeGetSeasonContext(deps: SeriesDeps) {
  return async function getSeasonContext(
    input: Learner,
  ): Promise<{ level: CefrLevel; episodes: { id: string; title: string; theme: string }[] }> {
    const { series, season } = await activeSeasonOf(deps, input);
    const episodes = await deps.series.listEpisodes(series.id);
    return {
      level: season.level,
      episodes: episodes
        .filter((episode) => episode.seasonId === season.id)
        .map(({ id, title, theme }) => ({ id, title, theme })),
    };
  };
}

export function makePlaceCards(deps: SeriesDeps) {
  return async function placeCards(
    input: Learner & {
      sessionId: string | null;
      cards: { learningItemId: string; theme: string; episodeId: string | null; episodeTitle: string }[];
    },
  ): Promise<{ newEpisodes: number; placed: number }> {
    if (input.cards.length === 0) return { newEpisodes: 0, placed: 0 };
    const { series, season } = await activeSeasonOf(deps, input);
    const seasonEpisodes = (await deps.series.listEpisodes(series.id)).filter(
      (episode) => episode.seasonId === season.id,
    );
    const plan = planPlacements({
      episodes: seasonEpisodes,
      requests: input.cards.map((card) => ({
        key: card.learningItemId,
        theme: card.theme,
        episodeId: card.episodeId,
        episodeTitle: card.episodeTitle,
      })),
    });
    const now = deps.clock.now();
    const resolved = new Map<string, string>();
    let newEpisodes = 0;
    for (const planned of plan.newEpisodes) {
      const created = await deps.series.createEpisode({
        id: deps.ids.next(),
        seriesId: series.id,
        seasonId: season.id,
        theme: planned.theme,
        part: planned.part,
        title: planned.title,
        now,
      });
      resolved.set(planned.ref, created.id);
      if (created.created) newEpisodes += 1;
    }
    const byEpisode = new Map<string, { learningItemId: string; sessionId: string | null }[]>();
    for (const assignment of plan.assignments) {
      const episodeId =
        assignment.target.kind === "existing"
          ? assignment.target.episodeId
          : resolved.get(assignment.target.ref);
      if (!episodeId) continue;
      const list = byEpisode.get(episodeId) ?? [];
      list.push({ learningItemId: assignment.key, sessionId: input.sessionId });
      byEpisode.set(episodeId, list);
    }
    let placed = 0;
    for (const [episodeId, cards] of byEpisode) {
      placed += await deps.series.addCards({ seriesId: series.id, episodeId, cards, now });
    }
    return { newEpisodes, placed };
  };
}

async function seriesOf(deps: SeriesDeps, input: Learner): Promise<Series> {
  return deps.series.ensureSeries({
    id: deps.ids.next(),
    userId: input.userId,
    pair: input.pair,
    startLevel: input.userLevel,
    now: deps.clock.now(),
  });
}

export function makeRenameSeries(deps: SeriesDeps) {
  return async function renameSeries(input: Learner & { name: string }): Promise<void> {
    const series = await seriesOf(deps, input);
    const trimmed = input.name.trim();
    const name = trimmed === "" ? null : cleanSeriesName(trimmed);
    if (trimmed !== "" && !name) throw new AppError("INVALID_INPUT", "seriesNameInvalid");
    await deps.series.rename(input.userId, series.id, name, deps.clock.now());
  };
}

export function makeSetSeriesLevel(deps: SeriesDeps) {
  return async function setSeriesLevel(input: Learner & { level: SeriesLevel }): Promise<void> {
    if (!validLevel(input.level)) throw new AppError("INVALID_INPUT", "seriesLevelInvalid");
    const series = await seriesOf(deps, input);
    const level: SeriesLevel =
      input.level.mode === "auto"
        ? { mode: "auto", min: null, max: null }
        : input.level.mode === "fixed"
          ? { mode: "fixed", min: input.level.min, max: null }
          : input.level;
    await deps.series.setLevel(input.userId, series.id, level, deps.clock.now());
  };
}

export function makeRefreshSeriesDescription(deps: SeriesDeps) {
  return async function refreshSeriesDescription(input: Learner): Promise<boolean> {
    const series = await deps.series.findSeries(input.userId, input.pair);
    if (!series) return false;
    const [episodes, hints] = await Promise.all([
      deps.series.listEpisodes(series.id),
      deps.learnerHints(input.userId, input.pair),
    ]);
    if (episodes.length === 0) return false;
    const parsed = seriesDescriptionSchema.safeParse(
      await deps.describe(input.userId, {
        level: input.userLevel,
        episodes: episodes.map((episode) => ({ title: episode.title, cards: episode.cardCount })),
        recentTopics: hints.recentTopics,
        improvements: hints.improvements,
      }),
    );
    if (!parsed.success) throw new AppError("LLM_INVALID_OUTPUT", "seriesDescriptionMalformed");
    await deps.series.saveDescription(
      input.userId,
      series.id,
      {
        text: parsed.data.description,
        basis: {
          conversations: hints.conversations,
          cards: episodes.reduce((sum, episode) => sum + episode.cardCount, 0),
        },
      },
      deps.clock.now(),
    );
    return true;
  };
}

export type EpisodeTrailView = {
  episode: Episode;
  season: Season;
  seriesName: string | null;
  nodes: EpisodeNode[];
  sources: EpisodeSource[];
  progress: number;
};

export function makeGetEpisodeTrail(deps: SeriesDeps) {
  return async function getEpisodeTrail(input: {
    userId: string;
    pair: LanguagePair;
    episodeId: string;
  }): Promise<EpisodeTrailView> {
    const episode = await deps.series.findEpisode(input.userId, input.episodeId);
    const series = await deps.series.findSeries(input.userId, input.pair);
    if (!episode || !series || series.id !== episode.seriesId) throw new AppError("ITEM_NOT_FOUND");
    const [cards, sources] = await Promise.all([
      deps.series.listEpisodeCards(episode.id, input.pair.native),
      deps.series.listEpisodeSources(episode.id),
    ]);
    const completed = new Set(episode.completedNodes);
    return {
      episode,
      season: episode.season,
      seriesName: series.name,
      nodes: episodeNodes(cards, completed),
      sources,
      progress: progressPercent(cards.length, completed),
    };
  };
}
