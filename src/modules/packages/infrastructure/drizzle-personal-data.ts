import { and, asc, eq, inArray } from "drizzle-orm";
import { isStudyLanguage, type StudyLanguage } from "@/shared/study-languages";
import type { Database } from "@/infrastructure/database/client";
import {
  episodeProgress,
  episodes,
  learningItemExplanations,
  learningItems,
  mediaItems,
  progressSnapshots,
  reviewLogs,
  seasons,
  subtitleCues,
  subtitleFiles,
  userAiCredentials,
  userCards,
  userHighlights,
  userPreferences,
  xpEvents,
} from "@/infrastructure/database/schema";
import type { KeyCipher } from "@/modules/ai-credentials";
import { isCredentialService, looksLikeSecret } from "@/modules/ai-credentials";
import type { CatalogRepository } from "@/modules/catalog";
import type { LearningRepository } from "@/modules/learning";
import type { IdGenerator } from "@/shared/ids";
import { workKeyOf, type EpisodeRef, type PackagedCard } from "../domain/package";
import { PERSONAL_FORMAT_VERSION, type PersonalCard, type PersonalData } from "../domain/personal";
import type {
  PersonalDataReader,
  PersonalDataWriter,
  PersonalMergeReport,
  PersonalWorkRef,
} from "../application/ports";

type Deps = {
  db: Database;
  catalog: CatalogRepository;
  learning: LearningRepository;
  keyCipher: KeyCipher;
  ids: IdGenerator;
};

type EpisodeLocation = {
  episodeId: string;
  ref: EpisodeRef;
  provider: "tmdb" | "fake" | "manual";
  externalId: string;
};

const asProvider = (value: string): "tmdb" | "fake" | "manual" =>
  value === "tmdb" || value === "fake" ? value : "manual";
const asLevel = (value: string) =>
  (["A1", "A2", "B1", "B2", "C1", "C2"].includes(value)
    ? value
    : "A1") as PersonalData["preferences"]["level"];

export class DrizzlePersonalData implements PersonalDataReader, PersonalDataWriter {
  constructor(private readonly deps: Deps) {}

  private async locateEpisodes(episodeIds: string[]): Promise<Map<string, EpisodeLocation>> {
    if (episodeIds.length === 0) return new Map();
    const rows = await this.deps.db
      .select({
        episodeId: episodes.id,
        episodeNumber: episodes.episodeNumber,
        seasonNumber: seasons.seasonNumber,
        provider: mediaItems.metadataProvider,
        externalId: mediaItems.externalId,
      })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(mediaItems, eq(mediaItems.id, seasons.mediaItemId))
      .where(inArray(episodes.id, [...new Set(episodeIds)]));
    return new Map(
      rows.map((row) => [
        row.episodeId,
        {
          episodeId: row.episodeId,
          provider: asProvider(row.provider),
          externalId: row.externalId,
          ref: {
            workKey: workKeyOf(row.provider, row.externalId),
            seasonNumber: row.seasonNumber,
            episodeNumber: row.episodeNumber,
          },
        },
      ]),
    );
  }

  private async cueSequences(
    cueIds: string[],
  ): Promise<Map<string, { sequence: number; language: StudyLanguage }>> {
    if (cueIds.length === 0) return new Map();
    const rows = await this.deps.db
      .select({ id: subtitleCues.id, sequence: subtitleCues.sequence, language: subtitleFiles.language })
      .from(subtitleCues)
      .innerJoin(subtitleFiles, eq(subtitleFiles.id, subtitleCues.subtitleFileId))
      .where(inArray(subtitleCues.id, [...new Set(cueIds)]));
    return new Map(
      rows.map((row) => [
        row.id,
        { sequence: row.sequence, language: isStudyLanguage(row.language) ? row.language : "en" },
      ]),
    );
  }

  async listReferencedWorks(userId: string): Promise<(PersonalWorkRef & { mediaId: string })[]> {
    const rows = await this.deps.db
      .selectDistinct({
        mediaId: mediaItems.id,
        provider: mediaItems.metadataProvider,
        externalId: mediaItems.externalId,
      })
      .from(episodeProgress)
      .innerJoin(episodes, eq(episodes.id, episodeProgress.episodeId))
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(mediaItems, eq(mediaItems.id, seasons.mediaItemId))
      .where(eq(episodeProgress.userId, userId));
    const fromCards = await this.deps.db
      .selectDistinct({
        mediaId: mediaItems.id,
        provider: mediaItems.metadataProvider,
        externalId: mediaItems.externalId,
      })
      .from(userCards)
      .innerJoin(learningItems, eq(learningItems.id, userCards.learningItemId))
      .innerJoin(episodes, eq(episodes.id, learningItems.episodeId))
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(mediaItems, eq(mediaItems.id, seasons.mediaItemId))
      .where(eq(userCards.userId, userId));
    const unique = new Map<string, PersonalWorkRef & { mediaId: string }>();
    for (const row of [...rows, ...fromCards]) {
      unique.set(row.mediaId, {
        mediaId: row.mediaId,
        metadataProvider: asProvider(row.provider),
        externalId: row.externalId,
      });
    }
    return [...unique.values()];
  }

  async collect(userId: string, includeCredentials: boolean): Promise<PersonalData> {
    const db = this.deps.db;
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    const highlightRows = await db.select().from(userHighlights).where(eq(userHighlights.userId, userId));
    const cardRows = await db
      .select({ card: userCards, item: learningItems, explanation: learningItemExplanations })
      .from(userCards)
      .innerJoin(learningItems, eq(learningItems.id, userCards.learningItemId))
      .leftJoin(learningItemExplanations, eq(learningItemExplanations.learningItemId, learningItems.id))
      .where(eq(userCards.userId, userId));
    const reviews = cardRows.length
      ? await db
          .select()
          .from(reviewLogs)
          .where(
            inArray(
              reviewLogs.userCardId,
              cardRows.map((row) => row.card.id),
            ),
          )
          .orderBy(asc(reviewLogs.reviewedAt))
      : [];
    const progressRows = await db.select().from(episodeProgress).where(eq(episodeProgress.userId, userId));
    const xpRows = await db.select().from(xpEvents).where(eq(xpEvents.userId, userId));
    const [snapshot] = await db
      .select()
      .from(progressSnapshots)
      .where(eq(progressSnapshots.userId, userId))
      .limit(1);
    const episodeIds = [
      ...highlightRows.map((row) => row.episodeId),
      ...progressRows.map((row) => row.episodeId),
      ...cardRows.flatMap((row) => (row.item.episodeId ? [row.item.episodeId] : [])),
    ];
    const locations = await this.locateEpisodes(episodeIds);
    const sequences = await this.cueSequences([
      ...highlightRows.map((row) => row.cueId),
      ...cardRows.flatMap((row) => (row.item.cueId ? [row.item.cueId] : [])),
    ]);
    const reviewsByCard = new Map<string, PersonalCard["reviews"]>();
    for (const review of reviews) {
      const list = reviewsByCard.get(review.userCardId) ?? [];
      list.push({
        rating: review.rating as PersonalCard["reviews"][number]["rating"],
        responseTimeMs: review.responseTimeMs,
        reviewedAt: review.reviewedAt.toISOString(),
      });
      reviewsByCard.set(review.userCardId, list);
    }
    const cards: PersonalCard[] = [];
    for (const { card, item, explanation } of cardRows) {
      const location = item.episodeId ? locations.get(item.episodeId) : undefined;
      const sequence = item.cueId ? sequences.get(item.cueId)?.sequence : undefined;
      const base = {
        sourceKind: card.sourceKind,
        dueAt: card.dueAt.toISOString(),
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        lapses: card.lapses,
        stability: card.stability,
        difficulty: card.difficulty,
        createdAt: card.createdAt.toISOString(),
        reviews: reviewsByCard.get(card.id) ?? [],
      };
      if (
        location &&
        sequence !== undefined &&
        item.startToken !== null &&
        item.endToken !== null &&
        explanation
      ) {
        const packaged: PackagedCard = {
          language: isStudyLanguage(item.language) ? item.language : "en",
          locale: isStudyLanguage(explanation.locale) ? explanation.locale : "pt-BR",
          cueSequence: sequence,
          startToken: item.startToken,
          endToken: item.endToken,
          startMs: item.startMs ?? 0,
          endMs: item.endMs ?? 0,
          kind: item.itemType === "sentence" ? "line" : item.startToken === item.endToken ? "word" : "phrase",
          term: item.sourceText,
          itemType: item.itemType as PackagedCard["itemType"],
          difficulty: item.difficulty as PackagedCard["difficulty"],
          meaning: explanation.translation,
          meaningSource: explanation.translationSource as PackagedCard["meaningSource"],
          pronunciation: explanation.pronunciationGuide,
          exampleEnglish: explanation.exampleEnglish,
          examplePortuguese: explanation.examplePortuguese,
          lineText: item.contextText ?? "",
          lineTranslation: explanation.contextTranslation,
          lineTranslationSource: (explanation.contextTranslationSource ??
            null) as PackagedCard["lineTranslationSource"],
        };
        cards.push({ ...base, item: { origin: "episode", ref: location.ref, card: packaged } });
      } else {
        cards.push({
          ...base,
          item: {
            origin: "standalone",
            language: isStudyLanguage(item.language) ? item.language : "en",
            locale: explanation && isStudyLanguage(explanation.locale) ? explanation.locale : "pt-BR",
            term: item.sourceText,
            meaning: explanation?.translation ?? "",
            context: item.contextText,
            source: item.origin,
          },
        });
      }
    }
    const credentials: PersonalData["credentials"] = [];
    if (includeCredentials) {
      const rows = await db.select().from(userAiCredentials).where(eq(userAiCredentials.userId, userId));
      for (const row of rows) {
        try {
          credentials.push({
            service: row.provider,
            secret: this.deps.keyCipher.decrypt(row.encryptedApiKey),
          });
        } catch {
          continue;
        }
      }
    }
    return {
      version: PERSONAL_FORMAT_VERSION,
      email: "",
      exportedAt: new Date().toISOString(),
      preferences: {
        level: asLevel(prefs?.level ?? "A1"),
        dailyGoal: prefs?.dailyGoal ?? 50,
        preferredAccent: prefs?.preferredAccent === "UK" ? "UK" : "US",
        audioSpeed: prefs?.audioSpeed ?? 1,
        timezone: prefs?.timezone ?? "America/Sao_Paulo",
      },
      highlights: highlightRows.flatMap((row) => {
        const location = locations.get(row.episodeId);
        const cue = sequences.get(row.cueId);
        if (!location || cue === undefined) return [];
        return [
          {
            ref: location.ref,
            language: cue.language,
            cueSequence: cue.sequence,
            startToken: row.startToken,
            endToken: row.endToken,
            kind: row.kind as "word" | "phrase" | "line",
            shareScope: row.shareScope === "catalog" ? ("catalog" as const) : ("private" as const),
            createdAt: row.createdAt.toISOString(),
          },
        ];
      }),
      cards,
      progress: progressRows.flatMap((row) => {
        const location = locations.get(row.episodeId);
        if (!location) return [];
        return [
          {
            ref: location.ref,
            status: row.status,
            progressPercent: row.progressPercent,
            lastPositionMs: row.lastPositionMs,
            completedAt: row.completedAt?.toISOString() ?? null,
            updatedAt: row.updatedAt.toISOString(),
          },
        ];
      }),
      xp: xpRows.map((row) => ({
        source: row.source,
        sourceId: row.sourceId,
        amount: row.amount,
        createdAt: row.createdAt.toISOString(),
      })),
      snapshot: snapshot ? { data: snapshot.data, updatedAt: snapshot.updatedAt.toISOString() } : null,
      credentials,
    };
  }

  private async resolveEpisode(ref: EpisodeRef): Promise<string | null> {
    const [provider, ...rest] = ref.workKey.split(":");
    const externalId = rest.join(":");
    if (!provider || !externalId) return null;
    const media = await this.deps.catalog.findMediaByExternal(asProvider(provider), externalId);
    if (!media) return null;
    const episode = (await this.deps.catalog.listEpisodesByMedia(media.id)).find(
      (candidate) =>
        candidate.seasonNumber === ref.seasonNumber && candidate.episodeNumber === ref.episodeNumber,
    );
    return episode?.id ?? null;
  }

  private async cuesOf(episodeId: string, language: StudyLanguage): Promise<Map<number, string>> {
    const [file] = await this.deps.db
      .select({ id: subtitleFiles.id })
      .from(subtitleFiles)
      .where(and(eq(subtitleFiles.episodeId, episodeId), eq(subtitleFiles.language, language)))
      .limit(1);
    if (!file) return new Map();
    const rows = await this.deps.db
      .select({ id: subtitleCues.id, sequence: subtitleCues.sequence })
      .from(subtitleCues)
      .where(eq(subtitleCues.subtitleFileId, file.id));
    return new Map(rows.map((row) => [row.sequence, row.id]));
  }

  async merge(userId: string, data: PersonalData, now: Date): Promise<PersonalMergeReport> {
    const db = this.deps.db;
    const report: PersonalMergeReport = {
      highlights: 0,
      cards: 0,
      reviews: 0,
      progress: 0,
      xp: 0,
      credentials: 0,
      skipped: 0,
    };
    const episodeCache = new Map<string, string | null>();
    const cueCache = new Map<string, Map<number, string>>();
    const episodeFor = async (ref: EpisodeRef): Promise<string | null> => {
      const key = `${ref.workKey}/${ref.seasonNumber}/${ref.episodeNumber}`;
      if (!episodeCache.has(key)) episodeCache.set(key, await this.resolveEpisode(ref));
      return episodeCache.get(key) ?? null;
    };
    const cueFor = async (
      episodeId: string,
      language: StudyLanguage,
      sequence: number,
    ): Promise<string | null> => {
      const key = `${episodeId}:${language}`;
      if (!cueCache.has(key)) cueCache.set(key, await this.cuesOf(episodeId, language));
      return cueCache.get(key)?.get(sequence) ?? null;
    };

    await db
      .update(userPreferences)
      .set({
        level: data.preferences.level,
        dailyGoal: data.preferences.dailyGoal,
        preferredAccent: data.preferences.preferredAccent,
        audioSpeed: data.preferences.audioSpeed,
        timezone: data.preferences.timezone,
      })
      .where(eq(userPreferences.userId, userId));

    for (const highlight of data.highlights) {
      const episodeId = await episodeFor(highlight.ref);
      const cueId = episodeId ? await cueFor(episodeId, highlight.language, highlight.cueSequence) : null;
      if (!episodeId || !cueId) {
        report.skipped += 1;
        continue;
      }
      const inserted = await db
        .insert(userHighlights)
        .values({
          id: this.deps.ids.next(),
          userId,
          episodeId,
          cueId,
          startToken: highlight.startToken,
          endToken: highlight.endToken,
          kind: highlight.kind,
          shareScope: highlight.shareScope,
          cardBatchId: null,
          createdAt: new Date(highlight.createdAt),
        })
        .onConflictDoNothing()
        .returning({ id: userHighlights.id });
      report.highlights += inserted.length;
    }

    for (const card of data.cards) {
      let learningItemId: string | null = null;
      if (card.item.origin === "episode") {
        const episodeId = await episodeFor(card.item.ref);
        const cueId = episodeId
          ? await cueFor(episodeId, card.item.card.language, card.item.card.cueSequence)
          : null;
        if (!episodeId || !cueId) {
          report.skipped += 1;
          continue;
        }
        const packaged = card.item.card;
        const pair = { target: packaged.language, native: packaged.locale };
        const reusable = (await this.deps.learning.findReusable(userId, episodeId, pair)).find(
          (item) =>
            item.cueId === cueId &&
            item.startToken === packaged.startToken &&
            item.endToken === packaged.endToken,
        );
        if (reusable) learningItemId = reusable.id;
        else {
          learningItemId = this.deps.ids.next();
          await this.deps.learning.createItem({
            id: learningItemId,
            episodeId,
            pair,
            visibility: "private",
            ownerUserId: userId,
            createdAt: new Date(card.createdAt),
            draft: {
              key: `${cueId}:${packaged.startToken}:${packaged.endToken}`,
              highlightId: "",
              cueId,
              startToken: packaged.startToken,
              endToken: packaged.endToken,
              kind: packaged.kind,
              term: packaged.term,
              itemType: packaged.itemType,
              difficulty: packaged.difficulty,
              meaning: packaged.meaning,
              meaningSource: packaged.meaningSource,
              pronunciation: packaged.pronunciation,
              exampleEnglish: packaged.exampleEnglish,
              examplePortuguese: packaged.examplePortuguese,
              lineText: packaged.lineText,
              lineTranslation: packaged.lineTranslation,
              lineTranslationSource: packaged.lineTranslationSource,
              startMs: packaged.startMs,
              endMs: packaged.endMs,
              reusedItemId: null,
            },
          });
        }
      } else {
        learningItemId = await this.deps.learning.upsertStandaloneItem({
          id: this.deps.ids.next(),
          ownerUserId: userId,
          pair: { target: card.item.language, native: card.item.locale },
          term: card.item.term,
          meaning: card.item.meaning,
          context: card.item.context,
          origin: card.item.source,
          createdAt: new Date(card.createdAt),
        });
      }
      const [existing] = await db
        .select()
        .from(userCards)
        .where(and(eq(userCards.userId, userId), eq(userCards.learningItemId, learningItemId)))
        .limit(1);
      const lastReview = card.reviews.at(-1)?.reviewedAt ?? card.createdAt;
      let cardId = existing?.id;
      if (!existing) {
        cardId = this.deps.ids.next();
        await db.insert(userCards).values({
          id: cardId,
          userId,
          learningItemId,
          sourceKind: card.sourceKind,
          dueAt: new Date(card.dueAt),
          intervalDays: card.intervalDays,
          repetitions: card.repetitions,
          lapses: card.lapses,
          stability: card.stability,
          difficulty: card.difficulty,
          createdAt: new Date(card.createdAt),
        });
        report.cards += 1;
      } else {
        const [localLast] = await db
          .select({ reviewedAt: reviewLogs.reviewedAt })
          .from(reviewLogs)
          .where(eq(reviewLogs.userCardId, existing.id))
          .orderBy(asc(reviewLogs.reviewedAt));
        const localStamp = localLast?.reviewedAt ?? existing.createdAt;
        if (new Date(lastReview) > localStamp) {
          await db
            .update(userCards)
            .set({
              dueAt: new Date(card.dueAt),
              intervalDays: card.intervalDays,
              repetitions: card.repetitions,
              lapses: card.lapses,
              stability: card.stability,
              difficulty: card.difficulty,
            })
            .where(eq(userCards.id, existing.id));
        }
      }
      if (!cardId) continue;
      const known = new Set(
        (
          await db
            .select({ reviewedAt: reviewLogs.reviewedAt })
            .from(reviewLogs)
            .where(eq(reviewLogs.userCardId, cardId))
        ).map((row) => row.reviewedAt.toISOString()),
      );
      for (const review of card.reviews) {
        if (known.has(new Date(review.reviewedAt).toISOString())) continue;
        await db.insert(reviewLogs).values({
          id: this.deps.ids.next(),
          userCardId: cardId,
          rating: review.rating,
          responseTimeMs: review.responseTimeMs,
          reviewedAt: new Date(review.reviewedAt),
        });
        report.reviews += 1;
      }
    }

    for (const entry of data.progress) {
      const episodeId = await episodeFor(entry.ref);
      if (!episodeId) {
        report.skipped += 1;
        continue;
      }
      const [local] = await db
        .select()
        .from(episodeProgress)
        .where(and(eq(episodeProgress.userId, userId), eq(episodeProgress.episodeId, episodeId)))
        .limit(1);
      if (local && local.updatedAt >= new Date(entry.updatedAt)) continue;
      await db
        .insert(episodeProgress)
        .values({
          userId,
          episodeId,
          status: entry.status,
          progressPercent: entry.progressPercent,
          lastPositionMs: entry.lastPositionMs,
          completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
          updatedAt: new Date(entry.updatedAt),
        })
        .onConflictDoUpdate({
          target: [episodeProgress.userId, episodeProgress.episodeId],
          set: {
            status: entry.status,
            progressPercent: entry.progressPercent,
            lastPositionMs: entry.lastPositionMs,
            completedAt: entry.completedAt ? new Date(entry.completedAt) : null,
            updatedAt: new Date(entry.updatedAt),
          },
        });
      report.progress += 1;
    }

    for (const event of data.xp) {
      const inserted = await db
        .insert(xpEvents)
        .values({
          id: this.deps.ids.next(),
          userId,
          source: event.source,
          sourceId: event.sourceId,
          amount: event.amount,
          createdAt: new Date(event.createdAt),
        })
        .onConflictDoNothing()
        .returning({ id: xpEvents.id });
      report.xp += inserted.length;
    }

    if (data.snapshot) {
      const [local] = await db
        .select()
        .from(progressSnapshots)
        .where(eq(progressSnapshots.userId, userId))
        .limit(1);
      if (!local || local.updatedAt < new Date(data.snapshot.updatedAt)) {
        await db
          .insert(progressSnapshots)
          .values({
            userId,
            data: data.snapshot.data as object,
            updatedAt: new Date(data.snapshot.updatedAt),
          })
          .onConflictDoUpdate({
            target: progressSnapshots.userId,
            set: { data: data.snapshot.data as object, updatedAt: new Date(data.snapshot.updatedAt) },
          });
      }
    }

    for (const credential of data.credentials) {
      if (!isCredentialService(credential.service) || !looksLikeSecret(credential.service, credential.secret))
        continue;
      await db
        .insert(userAiCredentials)
        .values({
          userId,
          provider: credential.service,
          encryptedApiKey: this.deps.keyCipher.encrypt(credential.secret),
          keyVersion: this.deps.keyCipher.version,
          updatedAt: now,
        })
        .onConflictDoNothing();
      report.credentials += 1;
    }
    return report;
  }
}
