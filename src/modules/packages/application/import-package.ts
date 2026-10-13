import type { Clock } from "@/shared/clock";
import { AppError, isAppError } from "@/shared/errors";
import type { IdGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { readPackage } from "./read-package";
import {
  episodeKey,
  type PackageArchive,
  type PackageCatalogReader,
  type PackageCatalogWriter,
} from "./ports";

type Deps = {
  reader: PackageCatalogReader;
  writer: PackageCatalogWriter;
  archive: PackageArchive;
  storage: FileStorage;
  clock: Clock;
  ids: IdGenerator;
};

export type PackagePreviewEpisode = {
  label: string;
  title: string;
  status: "new" | "exists";
  subtitles: number;
  cards: number;
};
export type PackagePreview = {
  uploadId: string;
  generatedAt: string;
  app: string;
  works: { title: string; status: "new" | "exists"; episodes: PackagePreviewEpisode[] }[];
  audio: number;
};

export type ImportReport = {
  worksCreated: number;
  episodesImported: number;
  episodesSkipped: number;
  cards: number;
  audio: number;
  warnings: string[];
};

const uploadPath = (userId: string, uploadId: string): string => `packages/${userId}/${uploadId}.zip`;
const AUDIO_PATH = (voiceId: string, hash: string, format: string) => `audio/${voiceId}/${hash}.${format}`;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

export function makeInspectPackage(deps: Pick<Deps, "reader" | "archive" | "storage" | "ids">) {
  return async function inspectPackage(input: {
    userId: string;
    bytes: Uint8Array;
  }): Promise<PackagePreview> {
    const pkg = await readPackage(deps.archive, input.bytes);
    const uploadId = deps.ids.next();
    await deps.storage.write(uploadPath(input.userId, uploadId), input.bytes);
    const works: PackagePreview["works"] = [];
    for (const work of pkg.catalog.works) {
      const local = await deps.reader.findWorkByExternal(work.metadataProvider, work.externalId);
      works.push({
        title: work.title,
        status: local ? "exists" : "new",
        episodes: work.episodes.map((episode) => ({
          label: work.type === "movie" ? "Filme" : `T${episode.seasonNumber} · E${episode.episodeNumber}`,
          title: episode.title,
          status: local?.readyEpisodes.has(episodeKey(episode.seasonNumber, episode.episodeNumber))
            ? "exists"
            : "new",
          subtitles: episode.subtitles.length,
          cards: episode.cardsPath ? pkg.cardsAt(episode.cardsPath).length : 0,
        })),
      });
    }
    return {
      uploadId,
      generatedAt: pkg.manifest.generatedAt,
      app: `${pkg.manifest.app.name} ${pkg.manifest.app.version}`,
      works,
      audio: pkg.audio.length,
    };
  };
}

export function makeImportPackage(deps: Deps) {
  return async function importPackage(input: { userId: string; uploadId: string }): Promise<ImportReport> {
    if (!SAFE_SEGMENT.test(input.uploadId)) throw new AppError("INVALID_INPUT");
    const bytes = await deps.storage.read(uploadPath(input.userId, input.uploadId));
    if (!bytes) throw new AppError("INVALID_INPUT", "O arquivo não está mais disponível. Escolha-o de novo.");
    const pkg = await readPackage(deps.archive, bytes);
    const now = deps.clock.now();
    const report: ImportReport = {
      worksCreated: 0,
      episodesImported: 0,
      episodesSkipped: 0,
      cards: 0,
      audio: 0,
      warnings: [],
    };
    for (const work of pkg.catalog.works) {
      const target = await deps.writer.ensureWork({ ...work, createdBy: input.userId, now });
      if (target.created) report.worksCreated += 1;
      for (const episode of work.episodes) {
        const episodeId = target.episodeIds.get(episodeKey(episode.seasonNumber, episode.episodeNumber));
        const label = `${work.title} · T${episode.seasonNumber} E${episode.episodeNumber}`;
        if (!episodeId) {
          report.warnings.push(`${label}: episódio não encontrado no catálogo.`);
          continue;
        }
        const english = episode.subtitles.find((subtitle) => subtitle.language === "en");
        const portuguese = episode.subtitles.find((subtitle) => subtitle.language === "pt-BR");
        if (english) {
          try {
            const outcome = await deps.writer.importSubtitles({
              userId: input.userId,
              episodeId,
              english: {
                filename: english.originalFilename,
                bytes: pkg.files.get(english.path) ?? new Uint8Array(),
              },
              portuguese: portuguese
                ? {
                    filename: portuguese.originalFilename,
                    bytes: pkg.files.get(portuguese.path) ?? new Uint8Array(),
                  }
                : null,
            });
            if (outcome === "PROCESSED") report.episodesImported += 1;
            else report.episodesSkipped += 1;
          } catch (error) {
            if (isAppError(error) && error.code === "SUBTITLE_VERSION_CONFLICT") {
              report.episodesSkipped += 1;
              report.warnings.push(`${label}: já tem outra legenda; ficou como está.`);
            } else if (isAppError(error)) {
              report.warnings.push(`${label}: ${error.message}`);
            } else {
              throw error;
            }
          }
        }
        if (episode.cardsPath) {
          const cues = new Map(
            (await deps.reader.listEnglishCues(episodeId)).map((cue) => [cue.sequence, cue.id]),
          );
          const existing = new Set(
            (await deps.reader.listCatalogCards(episodeId)).map(
              (card) => `${card.cueId}:${card.startToken}:${card.endToken}`,
            ),
          );
          for (const card of pkg.cardsAt(episode.cardsPath)) {
            const cueId = cues.get(card.cueSequence);
            if (!cueId || existing.has(`${cueId}:${card.startToken}:${card.endToken}`)) continue;
            await deps.writer.createCatalogCard({ id: deps.ids.next(), episodeId, cueId, card, now });
            existing.add(`${cueId}:${card.startToken}:${card.endToken}`);
            report.cards += 1;
          }
        }
      }
    }
    for (const asset of pkg.audio) {
      if (!SAFE_SEGMENT.test(asset.voiceId) || !SAFE_SEGMENT.test(asset.format)) continue;
      const content = pkg.files.get(asset.path);
      if (!content) continue;
      const storagePath = AUDIO_PATH(asset.voiceId, asset.textHash, asset.format);
      if (await deps.storage.exists(storagePath)) continue;
      await deps.storage.write(storagePath, content);
      await deps.writer.saveAudio({ ...asset, storagePath, id: deps.ids.next() }, now);
      report.audio += 1;
    }
    return report;
  };
}
