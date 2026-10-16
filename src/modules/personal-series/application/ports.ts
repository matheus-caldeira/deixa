import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair, StudyLanguage } from "@/shared/study-languages";
import type { Episode, EpisodeCard, Season, Series, SeriesLevel } from "../domain/series";

export type EpisodeSource = { sessionId: string; themeId: string; themeTitle: string; closedAt: Date | null };

export type OwnedEpisode = Episode & { seriesId: string; season: Season; completedNodes: number[] };

export interface PersonalSeriesRepository {
  findSeries(userId: string, pair: LanguagePair): Promise<Series | null>;
  ensureSeries(input: {
    id: string;
    userId: string;
    pair: LanguagePair;
    startLevel: CefrLevel;
    now: Date;
  }): Promise<Series>;
  listSeasons(seriesId: string): Promise<Season[]>;
  ensureSeason(input: { id: string; seriesId: string; level: CefrLevel; now: Date }): Promise<Season>;
  listEpisodes(seriesId: string): Promise<Episode[]>;
  createEpisode(input: {
    id: string;
    seriesId: string;
    seasonId: string;
    theme: string;
    part: number;
    title: string;
    now: Date;
  }): Promise<{ id: string; created: boolean }>;
  addCards(input: {
    seriesId: string;
    episodeId: string;
    cards: { learningItemId: string; sessionId: string | null }[];
    now: Date;
  }): Promise<number>;
  findEpisode(userId: string, episodeId: string): Promise<OwnedEpisode | null>;
  listEpisodeCards(episodeId: string, native: StudyLanguage): Promise<EpisodeCard[]>;
  listSeriesCards(seriesId: string, native: StudyLanguage, limit: number): Promise<EpisodeCard[]>;
  listEpisodeSources(episodeId: string): Promise<EpisodeSource[]>;
  completeNode(episodeId: string, nodeIndex: number, now: Date): Promise<boolean>;
  rename(userId: string, seriesId: string, name: string | null, now: Date): Promise<void>;
  setLevel(userId: string, seriesId: string, level: SeriesLevel, now: Date): Promise<void>;
  saveDescription(
    userId: string,
    seriesId: string,
    description: { text: string; basis: { conversations: number; cards: number } },
    now: Date,
  ): Promise<void>;
}

export type DescribeSeriesInput = {
  level: CefrLevel;
  episodes: { title: string; cards: number }[];
  recentTopics: string[];
  improvements: string[];
};

export type LearnerHints = { recentTopics: string[]; improvements: string[]; conversations: number };
