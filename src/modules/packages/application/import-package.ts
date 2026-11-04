import type { Clock } from "@/shared/clock";
import { AppError, isAppError } from "@/shared/errors";
import type { IdGenerator } from "@/shared/ids";
import type { FileStorage } from "@/shared/storage";
import { audioHash } from "@/modules/audio";
import { personalDataSchema } from "../domain/personal";
import { readPackage } from "./read-package";
import {
  episodeKey,
  type PackageArchive,
  type PackageCatalogReader,
  type PackageCatalogWriter,
  type PersonalCipher,
  type PersonalDataWriter,
  type PersonalMergeReport,
} from "./ports";

type Deps = {
  reader: PackageCatalogReader;
  writer: PackageCatalogWriter;
  archive: PackageArchive;
  storage: FileStorage;
  clock: Clock;
  ids: IdGenerator;
  personal: PersonalDataWriter;
  cipher: PersonalCipher;
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
  personal: { email: string; includesCredentials: boolean } | null;
};

export type ImportWarning = {
  key: "episodeMissing" | "subtitleKept" | "episodeFailed" | "personalSkipped";
  label: string;
};

export type ImportReport = {
  worksCreated: number;
  episodesImported: number;
  episodesSkipped: number;
  cards: number;
  audio: number;
  personal: PersonalMergeReport | null;
  skippedAudio: number;
  warnings: ImportWarning[];
};

export const accountUploadsDirectory = (userId: string): string => `packages/${userId}`;
const uploadPath = (userId: string, uploadId: string): string =>
  `${accountUploadsDirectory(userId)}/${uploadId}.zip`;
const AUDIO_PATH = (voiceId: string, hash: string, format: string) => `audio/${voiceId}/${hash}.${format}`;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const AUDIO_FORMAT = "wav";

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
      personal: pkg.personal
        ? { email: pkg.personal.meta.email, includesCredentials: pkg.personal.meta.includesCredentials }
        : null,
    };
  };
}

export function makePeekPersonalEmail(deps: Pick<Deps, "archive" | "storage">) {
  return async function peekPersonalEmail(input: {
    userId: string;
    uploadId: string;
  }): Promise<string | null> {
    if (!SAFE_SEGMENT.test(input.uploadId)) return null;
    const bytes = await deps.storage.read(uploadPath(input.userId, input.uploadId));
    if (!bytes) return null;
    const pkg = await readPackage(deps.archive, bytes);
    return pkg.personal?.meta.email.trim().toLowerCase() ?? null;
  };
}

export function makeImportPackage(deps: Deps) {
  return async function importPackage(input: {
    userId: string;
    uploadId: string;
    password?: string;
  }): Promise<ImportReport> {
    if (!SAFE_SEGMENT.test(input.uploadId)) throw new AppError("INVALID_INPUT");
    const bytes = await deps.storage.read(uploadPath(input.userId, input.uploadId));
    if (!bytes) throw new AppError("INVALID_INPUT", "uploadGone");
    const pkg = await readPackage(deps.archive, bytes);
    const now = deps.clock.now();
    const report: ImportReport = {
      worksCreated: 0,
      episodesImported: 0,
      episodesSkipped: 0,
      cards: 0,
      audio: 0,
      personal: null,
      skippedAudio: 0,
      warnings: [],
    };
    const importedEpisodeIds: string[] = [];
    for (const work of pkg.catalog.works) {
      const target = await deps.writer.ensureWork({ ...work, createdBy: input.userId, now });
      if (target.created) report.worksCreated += 1;
      for (const episode of work.episodes) {
        const episodeId = target.episodeIds.get(episodeKey(episode.seasonNumber, episode.episodeNumber));
        const label = `${work.title} · T${episode.seasonNumber} E${episode.episodeNumber}`;
        if (!episodeId) {
          report.warnings.push({ key: "episodeMissing", label });
          continue;
        }
        importedEpisodeIds.push(episodeId);
        const [first, second, ...rest] = episode.subtitles;
        const upload = (subtitle: NonNullable<typeof first>) => ({
          language: subtitle.language,
          upload: {
            filename: subtitle.originalFilename,
            bytes: pkg.files.get(subtitle.path) ?? new Uint8Array(),
          },
        });
        if (first) {
          try {
            const outcome = await deps.writer.importSubtitles({
              userId: input.userId,
              episodeId,
              target: upload(first),
              native: second ? upload(second) : null,
            });
            for (const extra of rest) {
              await deps.writer.importSubtitles({
                userId: input.userId,
                episodeId,
                target: upload(extra),
                native: null,
              });
            }
            if (outcome === "PROCESSED") report.episodesImported += 1;
            else report.episodesSkipped += 1;
          } catch (error) {
            if (isAppError(error) && error.code === "SUBTITLE_VERSION_CONFLICT") {
              report.episodesSkipped += 1;
              report.warnings.push({ key: "subtitleKept", label });
            } else if (isAppError(error)) {
              report.warnings.push({ key: "episodeFailed", label: `${label} (${error.code})` });
            } else {
              throw error;
            }
          }
        }
        if (episode.cardsPath) {
          const cues = new Map(
            (await deps.reader.listCues(episodeId)).map((cue) => [`${cue.language}:${cue.sequence}`, cue.id]),
          );
          const existing = new Set(
            (await deps.reader.listCatalogCards(episodeId)).map(
              (card) => `${card.cueId}:${card.startToken}:${card.endToken}`,
            ),
          );
          for (const card of pkg.cardsAt(episode.cardsPath)) {
            const cueId = cues.get(`${card.language}:${card.cueSequence}`);
            if (!cueId || existing.has(`${cueId}:${card.startToken}:${card.endToken}`)) continue;
            await deps.writer.createCatalogCard({ id: deps.ids.next(), episodeId, cueId, card, now });
            existing.add(`${cueId}:${card.startToken}:${card.endToken}`);
            report.cards += 1;
          }
        }
      }
    }
    const knownTexts: string[] = [];
    for (const episodeId of importedEpisodeIds) {
      knownTexts.push(...(await deps.reader.listCues(episodeId)).map((cue) => cue.text));
    }
    for (const asset of pkg.audio) {
      if (!SAFE_SEGMENT.test(asset.voiceId) || asset.format !== AUDIO_FORMAT) continue;
      const content = pkg.files.get(asset.path);
      if (!content) continue;
      const expected = new Set(
        knownTexts.map((text) =>
          audioHash({
            text,
            voiceId: asset.voiceId,
            language: asset.language,
            modelVersion: asset.modelVersion,
          }),
        ),
      );
      if (!expected.has(asset.textHash)) {
        report.skippedAudio += 1;
        continue;
      }
      const storagePath = AUDIO_PATH(asset.voiceId, asset.textHash, asset.format);
      if (await deps.storage.exists(storagePath)) continue;
      await deps.storage.write(storagePath, content);
      await deps.writer.saveAudio({ ...asset, storagePath, id: deps.ids.next() }, now);
      report.audio += 1;
    }
    if (pkg.personal) {
      if (!input.password) {
        report.warnings.push({ key: "personalSkipped", label: pkg.personal.meta.email });
      } else {
        const opened = await deps.cipher.open(pkg.personal.sealed, pkg.personal.meta.email, input.password);
        const parsed = opened
          ? personalDataSchema.safeParse(JSON.parse(new TextDecoder().decode(opened)))
          : null;
        if (!parsed || !parsed.success) {
          throw new AppError(
            "INVALID_CREDENTIALS",
            "Senha incorreta ou dados pessoais danificados. Nada foi gravado.",
          );
        }
        report.personal = await deps.personal.merge(input.userId, parsed.data, now);
      }
    }
    return report;
  };
}
