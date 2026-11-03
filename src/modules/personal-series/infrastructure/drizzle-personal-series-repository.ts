import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/infrastructure/database/client";
import { qualified } from "@/infrastructure/database/qualified";
import {
  conversationSessions,
  learningItemExplanations,
  learningItems,
  personalEpisodeCards,
  personalEpisodes,
  personalSeasons,
  personalSeries,
} from "@/infrastructure/database/schema";
import { isCefrLevel, type CefrLevel } from "@/shared/levels";
import { normalizeLanguageTag, type LanguagePair, type StudyLanguage } from "@/shared/study-languages";
import {
  LEVEL_MODES,
  type Episode,
  type EpisodeCard,
  type Season,
  type Series,
  type SeriesLevel,
} from "../domain/series";
import type { EpisodeSource, OwnedEpisode, PersonalSeriesRepository } from "../application/ports";

type SeriesRow = typeof personalSeries.$inferSelect;
type SeasonRow = typeof personalSeasons.$inferSelect;

const basisSchema = z.object({ conversations: z.number(), cards: z.number() });
const nodesSchema = z.array(z.number().int().min(0));

const levelOrNull = (value: string | null): CefrLevel | null => (isCefrLevel(value) ? value : null);

function toSeries(row: SeriesRow): Series {
  const basis = basisSchema.safeParse(row.descriptionBasis);
  const mode = LEVEL_MODES.find((candidate) => candidate === row.levelMode) ?? "auto";
  return {
    id: row.id,
    userId: row.userId,
    pair: {
      target: normalizeLanguageTag(row.targetLanguage) ?? "en",
      native: normalizeLanguageTag(row.nativeLanguage) ?? "pt-BR",
    },
    name: row.name,
    description: row.description,
    descriptionUpdatedAt: row.descriptionUpdatedAt,
    descriptionBasis: basis.success ? basis.data : null,
    level: { mode, min: levelOrNull(row.levelMin), max: levelOrNull(row.levelMax) },
    startLevel: levelOrNull(row.startLevel) ?? "A1",
    createdAt: row.createdAt,
  };
}

function toSeason(row: SeasonRow): Season {
  return { id: row.id, number: row.number, level: levelOrNull(row.level) ?? "A1" };
}

const isId = (value: string): boolean => z.uuid().safeParse(value).success;

export class DrizzlePersonalSeriesRepository implements PersonalSeriesRepository {
  constructor(private readonly db: Database) {}

  private pairFilter(userId: string, pair: LanguagePair) {
    return and(
      eq(personalSeries.userId, userId),
      eq(personalSeries.targetLanguage, pair.target),
      eq(personalSeries.nativeLanguage, pair.native),
    );
  }

  async findSeries(userId: string, pair: LanguagePair): Promise<Series | null> {
    const [row] = await this.db.select().from(personalSeries).where(this.pairFilter(userId, pair)).limit(1);
    return row ? toSeries(row) : null;
  }

  async ensureSeries(input: {
    id: string;
    userId: string;
    pair: LanguagePair;
    startLevel: CefrLevel;
    now: Date;
  }): Promise<Series> {
    await this.db
      .insert(personalSeries)
      .values({
        id: input.id,
        userId: input.userId,
        targetLanguage: input.pair.target,
        nativeLanguage: input.pair.native,
        startLevel: input.startLevel,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .onConflictDoNothing();
    const found = await this.findSeries(input.userId, input.pair);
    if (!found) throw new Error("personal series missing after insert");
    return found;
  }

  async listSeasons(seriesId: string): Promise<Season[]> {
    const rows = await this.db
      .select()
      .from(personalSeasons)
      .where(eq(personalSeasons.seriesId, seriesId))
      .orderBy(asc(personalSeasons.number));
    return rows.map(toSeason);
  }

  async ensureSeason(input: { id: string; seriesId: string; level: CefrLevel; now: Date }): Promise<Season> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.seriesId}))`);
      const [known] = await tx
        .select()
        .from(personalSeasons)
        .where(and(eq(personalSeasons.seriesId, input.seriesId), eq(personalSeasons.level, input.level)))
        .limit(1);
      if (known) return toSeason(known);
      const [last] = await tx
        .select({ number: sql<number>`coalesce(max(${personalSeasons.number}), 0)::int` })
        .from(personalSeasons)
        .where(eq(personalSeasons.seriesId, input.seriesId));
      const [created] = await tx
        .insert(personalSeasons)
        .values({
          id: input.id,
          seriesId: input.seriesId,
          level: input.level,
          number: (last?.number ?? 0) + 1,
          createdAt: input.now,
        })
        .returning();
      if (!created) throw new Error("personal season not created");
      return toSeason(created);
    });
  }

  async listEpisodes(seriesId: string): Promise<Episode[]> {
    const cardCount = sql<number>`(select count(*)::int from ${personalEpisodeCards} where ${qualified(personalEpisodeCards.episodeId)} = ${qualified(personalEpisodes.id)})`;
    const sourceCount = sql<number>`(select count(distinct ${qualified(personalEpisodeCards.sessionId)})::int from ${personalEpisodeCards} where ${qualified(personalEpisodeCards.episodeId)} = ${qualified(personalEpisodes.id)})`;
    const rows = await this.db
      .select({ episode: personalEpisodes, cardCount, sourceCount })
      .from(personalEpisodes)
      .where(eq(personalEpisodes.seriesId, seriesId))
      .orderBy(asc(personalEpisodes.number));
    return rows.map(({ episode, cardCount: cards, sourceCount: sources }) => ({
      id: episode.id,
      seasonId: episode.seasonId,
      number: episode.number,
      title: episode.title,
      theme: episode.theme,
      part: episode.part,
      cardCount: cards,
      sourceCount: sources,
      createdAt: episode.createdAt,
    }));
  }

  async createEpisode(input: {
    id: string;
    seriesId: string;
    seasonId: string;
    theme: string;
    part: number;
    title: string;
    now: Date;
  }): Promise<{ id: string; created: boolean }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.seasonId}))`);
      const [known] = await tx
        .select({ id: personalEpisodes.id })
        .from(personalEpisodes)
        .where(
          and(
            eq(personalEpisodes.seasonId, input.seasonId),
            eq(personalEpisodes.theme, input.theme),
            eq(personalEpisodes.part, input.part),
          ),
        )
        .limit(1);
      if (known) return { id: known.id, created: false };
      const [last] = await tx
        .select({ number: sql<number>`coalesce(max(${personalEpisodes.number}), 0)::int` })
        .from(personalEpisodes)
        .where(eq(personalEpisodes.seasonId, input.seasonId));
      await tx.insert(personalEpisodes).values({
        id: input.id,
        seriesId: input.seriesId,
        seasonId: input.seasonId,
        number: (last?.number ?? 0) + 1,
        title: input.title,
        theme: input.theme,
        part: input.part,
        createdAt: input.now,
        updatedAt: input.now,
      });
      return { id: input.id, created: true };
    });
  }

  async addCards(input: {
    seriesId: string;
    episodeId: string;
    cards: { learningItemId: string; sessionId: string | null }[];
    now: Date;
  }): Promise<number> {
    if (input.cards.length === 0) return 0;
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.episodeId}))`);
      const [last] = await tx
        .select({ position: sql<number>`coalesce(max(${personalEpisodeCards.position}), -1)::int` })
        .from(personalEpisodeCards)
        .where(eq(personalEpisodeCards.episodeId, input.episodeId));
      const start = (last?.position ?? -1) + 1;
      const inserted = await tx
        .insert(personalEpisodeCards)
        .values(
          input.cards.map((card, index) => ({
            seriesId: input.seriesId,
            episodeId: input.episodeId,
            learningItemId: card.learningItemId,
            sessionId: card.sessionId,
            position: start + index,
            createdAt: input.now,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: personalEpisodeCards.learningItemId });
      if (inserted.length > 0) {
        await tx
          .update(personalEpisodes)
          .set({ updatedAt: input.now })
          .where(eq(personalEpisodes.id, input.episodeId));
      }
      return inserted.length;
    });
  }

  async findEpisode(userId: string, episodeId: string): Promise<OwnedEpisode | null> {
    if (!isId(episodeId)) return null;
    const cardCount = sql<number>`(select count(*)::int from ${personalEpisodeCards} where ${qualified(personalEpisodeCards.episodeId)} = ${qualified(personalEpisodes.id)})`;
    const sourceCount = sql<number>`(select count(distinct ${qualified(personalEpisodeCards.sessionId)})::int from ${personalEpisodeCards} where ${qualified(personalEpisodeCards.episodeId)} = ${qualified(personalEpisodes.id)})`;
    const [row] = await this.db
      .select({ episode: personalEpisodes, season: personalSeasons, cardCount, sourceCount })
      .from(personalEpisodes)
      .innerJoin(personalSeries, eq(personalSeries.id, personalEpisodes.seriesId))
      .innerJoin(personalSeasons, eq(personalSeasons.id, personalEpisodes.seasonId))
      .where(and(eq(personalEpisodes.id, episodeId), eq(personalSeries.userId, userId)))
      .limit(1);
    if (!row) return null;
    const nodes = nodesSchema.safeParse(row.episode.completedNodes);
    return {
      id: row.episode.id,
      seriesId: row.episode.seriesId,
      seasonId: row.episode.seasonId,
      number: row.episode.number,
      title: row.episode.title,
      theme: row.episode.theme,
      part: row.episode.part,
      cardCount: row.cardCount,
      sourceCount: row.sourceCount,
      createdAt: row.episode.createdAt,
      season: toSeason(row.season),
      completedNodes: nodes.success ? nodes.data : [],
    };
  }

  private cardsQuery(native: StudyLanguage) {
    return this.db
      .select({
        learningItemId: learningItems.id,
        term: learningItems.sourceText,
        translation: learningItemExplanations.translation,
      })
      .from(personalEpisodeCards)
      .innerJoin(learningItems, eq(learningItems.id, personalEpisodeCards.learningItemId))
      .leftJoin(
        learningItemExplanations,
        and(
          eq(learningItemExplanations.learningItemId, learningItems.id),
          eq(learningItemExplanations.locale, native),
        ),
      );
  }

  async listEpisodeCards(episodeId: string, native: StudyLanguage): Promise<EpisodeCard[]> {
    return this.cardsQuery(native)
      .where(eq(personalEpisodeCards.episodeId, episodeId))
      .orderBy(asc(personalEpisodeCards.position));
  }

  async listSeriesCards(seriesId: string, native: StudyLanguage, limit: number): Promise<EpisodeCard[]> {
    return this.cardsQuery(native)
      .where(eq(personalEpisodeCards.seriesId, seriesId))
      .orderBy(asc(personalEpisodeCards.createdAt))
      .limit(limit);
  }

  async listEpisodeSources(episodeId: string): Promise<EpisodeSource[]> {
    return this.db
      .selectDistinct({
        sessionId: conversationSessions.id,
        themeId: conversationSessions.themeId,
        themeTitle: conversationSessions.themeTitle,
        closedAt: conversationSessions.closedAt,
      })
      .from(personalEpisodeCards)
      .innerJoin(conversationSessions, eq(conversationSessions.id, personalEpisodeCards.sessionId))
      .where(eq(personalEpisodeCards.episodeId, episodeId));
  }

  async completeNode(episodeId: string, nodeIndex: number, now: Date): Promise<boolean> {
    const updated = await this.db
      .update(personalEpisodes)
      .set({
        completedNodes: sql`${personalEpisodes.completedNodes} || ${JSON.stringify([nodeIndex])}::jsonb`,
        updatedAt: now,
      })
      .where(
        and(
          eq(personalEpisodes.id, episodeId),
          sql`not (${personalEpisodes.completedNodes} @> ${JSON.stringify([nodeIndex])}::jsonb)`,
        ),
      )
      .returning({ id: personalEpisodes.id });
    return updated.length > 0;
  }

  async rename(userId: string, seriesId: string, name: string | null, now: Date): Promise<void> {
    await this.db
      .update(personalSeries)
      .set({ name, updatedAt: now })
      .where(and(eq(personalSeries.id, seriesId), eq(personalSeries.userId, userId)));
  }

  async setLevel(userId: string, seriesId: string, level: SeriesLevel, now: Date): Promise<void> {
    await this.db
      .update(personalSeries)
      .set({ levelMode: level.mode, levelMin: level.min, levelMax: level.max, updatedAt: now })
      .where(and(eq(personalSeries.id, seriesId), eq(personalSeries.userId, userId)));
  }

  async saveDescription(
    userId: string,
    seriesId: string,
    description: { text: string; basis: { conversations: number; cards: number } },
    now: Date,
  ): Promise<void> {
    await this.db
      .update(personalSeries)
      .set({
        description: description.text,
        descriptionBasis: description.basis,
        descriptionUpdatedAt: now,
        updatedAt: now,
      })
      .where(and(eq(personalSeries.id, seriesId), eq(personalSeries.userId, userId)));
  }
}
