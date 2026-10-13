import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "@/infrastructure/database/client";
import {
  audioAssets,
  learningItemExplanations,
  learningItems,
  subtitleCues,
} from "@/infrastructure/database/schema";
import { audioHash, type AudioAssetRepository, type Voice } from "@/modules/audio";
import type { CatalogRepository, MediaItem } from "@/modules/catalog";
import { posterColorsFor } from "@/modules/catalog";
import type { LearningRepository } from "@/modules/learning";
import type { SubtitleRepository } from "@/modules/subtitles";
import type { IdGenerator } from "@/shared/ids";
import type { PackagedCard } from "../domain/package";
import type {
  CueRef,
  ExportableAudio,
  ExportableEpisode,
  ExportableSeason,
  ExportableSubtitle,
  ExportableWork,
  LocalWork,
  PackageCatalogReader,
  PackageCatalogWriter,
} from "../application/ports";

const ORIGIN_HIGHLIGHT = "user_highlight";
const LOCALE = "pt-BR";
const ENGLISH = "en";

type Deps = {
  db: Database;
  catalog: CatalogRepository;
  subtitles: SubtitleRepository;
  learning: LearningRepository;
  audio: AudioAssetRepository;
  importSubtitles: PackageCatalogWriter["importSubtitles"];
  ids: IdGenerator;
  voices: Voice[];
  modelVersion: string;
};

const asWork = (media: MediaItem): ExportableWork => ({
  id: media.id,
  metadataProvider: media.metadataProvider,
  externalId: media.externalId,
  type: media.type,
  title: media.title,
  originalTitle: media.originalTitle,
  overview: media.overview,
  year: media.year,
  posterPath: media.posterPath,
  backdropPath: media.backdropPath,
  posterColors: media.posterColors,
  levelMin: media.levelMin,
  levelMax: media.levelMax,
  accent: media.accent,
});

export class DrizzlePackageCatalog implements PackageCatalogReader, PackageCatalogWriter {
  constructor(private readonly deps: Deps) {}

  async findWork(mediaId: string): Promise<ExportableWork | null> {
    const media = await this.deps.catalog.findMediaById(mediaId);
    return media ? asWork(media) : null;
  }

  async findWorkByExternal(metadataProvider: string, externalId: string): Promise<LocalWork | null> {
    const provider = metadataProvider === "tmdb" || metadataProvider === "fake" ? metadataProvider : "manual";
    const media = await this.deps.catalog.findMediaByExternal(provider, externalId);
    if (!media) return null;
    const episodes = await this.deps.catalog.listEpisodesByMedia(media.id);
    return {
      mediaId: media.id,
      title: media.title,
      readyEpisodes: new Set(
        episodes
          .filter((episode) => episode.status === "READY")
          .map((episode) => `s${episode.seasonNumber}e${episode.episodeNumber}`),
      ),
    };
  }

  async listSeasons(mediaId: string): Promise<ExportableSeason[]> {
    return (await this.deps.catalog.listSeasons(mediaId)).map(
      ({ id, seasonNumber, title, episodeCount }) => ({
        id,
        seasonNumber,
        title,
        episodeCount,
      }),
    );
  }

  async listEpisodes(mediaId: string): Promise<ExportableEpisode[]> {
    return (await this.deps.catalog.listEpisodesByMedia(mediaId)).map((episode) => ({
      id: episode.id,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      overview: episode.overview,
      durationSeconds: episode.durationSeconds,
      stillPath: episode.stillPath,
      ready: episode.status === "READY",
    }));
  }

  async listSubtitles(episodeId: string): Promise<ExportableSubtitle[]> {
    return (await this.deps.subtitles.listFiles(episodeId)).map((file) => ({
      language: file.language,
      sha256: file.sha256,
      storagePath: file.storagePath,
      originalFilename: `original.${file.language}.srt`,
    }));
  }

  async listEnglishCues(episodeId: string): Promise<CueRef[]> {
    const english = (await this.deps.subtitles.listFiles(episodeId)).find(
      (file) => file.language === ENGLISH,
    );
    if (!english) return [];
    return (await this.deps.subtitles.listCues(english.id)).map(({ id, sequence, text }) => ({
      id,
      sequence,
      text,
    }));
  }

  async listCatalogCards(episodeId: string): Promise<(PackagedCard & { cueId: string })[]> {
    const rows = await this.deps.db
      .select({ item: learningItems, explanation: learningItemExplanations, sequence: subtitleCues.sequence })
      .from(learningItems)
      .innerJoin(
        learningItemExplanations,
        and(
          eq(learningItemExplanations.learningItemId, learningItems.id),
          eq(learningItemExplanations.locale, LOCALE),
        ),
      )
      .innerJoin(subtitleCues, eq(subtitleCues.id, learningItems.cueId))
      .where(
        and(
          eq(learningItems.episodeId, episodeId),
          eq(learningItems.origin, ORIGIN_HIGHLIGHT),
          eq(learningItems.visibility, "global"),
          eq(learningItems.status, "ACTIVE"),
          isNotNull(learningItems.cueId),
        ),
      )
      .orderBy(asc(subtitleCues.sequence), asc(learningItems.startToken));
    return rows.flatMap(({ item, explanation, sequence }) => {
      if (item.cueId === null || item.startToken === null || item.endToken === null) return [];
      const kind =
        item.itemType === "sentence" ? "line" : item.startToken === item.endToken ? "word" : "phrase";
      return [
        {
          cueId: item.cueId,
          cueSequence: sequence,
          startToken: item.startToken,
          endToken: item.endToken,
          startMs: item.startMs ?? 0,
          endMs: item.endMs ?? 0,
          kind: kind as PackagedCard["kind"],
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
        },
      ];
    });
  }

  async listAudioForTexts(texts: string[]): Promise<ExportableAudio[]> {
    const hashes = new Set<string>();
    for (const voice of this.deps.voices) {
      for (const text of texts)
        hashes.add(audioHash({ text, ...voice, modelVersion: this.deps.modelVersion }));
    }
    if (hashes.size === 0) return [];
    const rows = await this.deps.db
      .select()
      .from(audioAssets)
      .where(and(inArray(audioAssets.textHash, [...hashes]), eq(audioAssets.status, "READY")));
    return rows.map((row) => ({
      textHash: row.textHash,
      voiceId: row.voiceId,
      language: row.language,
      modelVersion: row.modelVersion,
      format: row.format,
      storagePath: row.storagePath,
    }));
  }

  async ensureWork(work: Parameters<PackageCatalogWriter["ensureWork"]>[0]) {
    const existing = await this.deps.catalog.findMediaByExternal(work.metadataProvider, work.externalId);
    let mediaId = existing?.id;
    if (!mediaId) {
      mediaId = await this.deps.catalog.upsertMedia({
        id: this.deps.ids.next(),
        type: work.type,
        title: work.title,
        originalTitle: work.originalTitle,
        overview: work.overview,
        year: work.year,
        metadataProvider: work.metadataProvider,
        externalId: work.externalId,
        posterPath: work.posterPath,
        backdropPath: work.backdropPath,
        posterColors: work.posterColors ?? posterColorsFor(work.title),
        levelMin: work.levelMin,
        levelMax: work.levelMax,
        accent: work.accent,
        createdBy: work.createdBy,
        syncedAt: null,
        createdAt: work.now,
      });
    }
    const known = await this.deps.catalog.listSeasons(mediaId);
    const missingSeasons = work.seasons.filter(
      (season) => !known.some((candidate) => candidate.seasonNumber === season.seasonNumber),
    );
    if (missingSeasons.length > 0) {
      await this.deps.catalog.upsertSeasons(
        mediaId,
        missingSeasons.map((season) => ({ id: this.deps.ids.next(), ...season })),
      );
    }
    const seasons = await this.deps.catalog.listSeasons(mediaId);
    const knownEpisodes = await this.deps.catalog.listEpisodesByMedia(mediaId);
    for (const season of seasons) {
      const missing = work.episodes
        .filter((episode) => episode.seasonNumber === season.seasonNumber)
        .filter(
          (episode) =>
            !knownEpisodes.some(
              (candidate) =>
                candidate.seasonNumber === episode.seasonNumber &&
                candidate.episodeNumber === episode.episodeNumber,
            ),
        );
      if (missing.length === 0) continue;
      await this.deps.catalog.upsertEpisodes(
        season.id,
        missing.map((episode) => ({
          id: this.deps.ids.next(),
          episodeNumber: episode.episodeNumber,
          title: episode.title,
          overview: episode.overview,
          durationSeconds: episode.durationSeconds,
          stillPath: episode.stillPath,
        })),
        null,
      );
    }
    const episodeIds = new Map(
      (await this.deps.catalog.listEpisodesByMedia(mediaId)).map((episode) => [
        `s${episode.seasonNumber}e${episode.episodeNumber}`,
        episode.id,
      ]),
    );
    return { mediaId, created: !existing, episodeIds };
  }

  importSubtitles(input: Parameters<PackageCatalogWriter["importSubtitles"]>[0]) {
    return this.deps.importSubtitles(input);
  }

  async createCatalogCard(input: {
    id: string;
    episodeId: string;
    cueId: string;
    card: PackagedCard;
    now: Date;
  }) {
    const { card } = input;
    await this.deps.learning.createItem({
      id: input.id,
      episodeId: input.episodeId,
      visibility: "global",
      ownerUserId: null,
      createdAt: input.now,
      draft: {
        key: `${input.cueId}:${card.startToken}:${card.endToken}`,
        highlightId: "",
        cueId: input.cueId,
        startToken: card.startToken,
        endToken: card.endToken,
        kind: card.kind,
        term: card.term,
        itemType: card.itemType,
        difficulty: card.difficulty,
        meaning: card.meaning,
        meaningSource: card.meaningSource,
        pronunciation: card.pronunciation,
        exampleEnglish: card.exampleEnglish,
        examplePortuguese: card.examplePortuguese,
        lineText: card.lineText,
        lineTranslation: card.lineTranslation,
        lineTranslationSource: card.lineTranslationSource,
        startMs: card.startMs,
        endMs: card.endMs,
        reusedItemId: null,
      },
    });
  }

  async saveAudio(asset: ExportableAudio & { id: string }, now: Date): Promise<void> {
    await this.deps.audio.save(asset, now);
  }
}
