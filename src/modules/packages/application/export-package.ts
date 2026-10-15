import { APP_NAME, APP_VERSION } from "@/shared/app";
import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { sha256Hex } from "@/shared/hash";
import type { FileStorage } from "@/shared/storage";
import {
  AUDIO_DIR,
  AUDIO_INDEX_PATH,
  CARDS_DIR,
  CATALOG_PATH,
  MANIFEST_PATH,
  PACKAGE_EXTENSION,
  PACKAGE_FORMAT_VERSION,
  SUBTITLES_DIR,
  episodeDir,
  workKeyOf,
  type ExportOptions,
  type ExportScope,
  type Manifest,
  type PackagedAudio,
  type PackagedCatalog,
  type PackagedEpisode,
} from "../domain/package";
import type { ExportableEpisode, PackageArchive, PackageCatalogReader, PackageFile } from "./ports";

type Deps = { reader: PackageCatalogReader; archive: PackageArchive; storage: FileStorage; clock: Clock };

export type ExportSummary = { episodes: number; subtitles: number; cards: number; audio: number };
export type ExportedPackage = { filename: string; bytes: Uint8Array; summary: ExportSummary };

const slug = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "pacote";

function inScope(scope: ExportScope, episode: ExportableEpisode): boolean {
  if (scope.kind === "work") return true;
  if (scope.kind === "season") return episode.seasonNumber === scope.seasonNumber;
  return episode.id === scope.episodeId;
}

export function makeExportPackage(deps: Deps) {
  return async function exportPackage(input: {
    scope: ExportScope;
    options: ExportOptions;
  }): Promise<ExportedPackage> {
    const work = await deps.reader.findWork(input.scope.mediaId);
    if (!work) throw new AppError("MEDIA_NOT_FOUND");
    const seasons = await deps.reader.listSeasons(work.id);
    const episodes = (await deps.reader.listEpisodes(work.id)).filter((episode) =>
      inScope(input.scope, episode),
    );
    if (episodes.length === 0) throw new AppError("EPISODE_NOT_FOUND");
    const workKey = workKeyOf(work.metadataProvider, work.externalId);
    const files: PackageFile[] = [];
    const audioIndex: PackagedAudio[] = [];
    const audioSeen = new Set<string>();
    const summary: ExportSummary = { episodes: episodes.length, subtitles: 0, cards: 0, audio: 0 };
    const packagedEpisodes: PackagedEpisode[] = [];

    for (const episode of episodes) {
      const dir = episodeDir({
        workKey,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
      });
      const packaged: PackagedEpisode = {
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        overview: episode.overview,
        durationSeconds: episode.durationSeconds,
        stillPath: episode.stillPath,
        subtitles: [],
        cardsPath: null,
      };
      if (episode.ready && input.options.subtitles) {
        for (const subtitle of await deps.reader.listSubtitles(episode.id)) {
          const bytes = await deps.storage.read(subtitle.storagePath);
          if (!bytes) continue;
          const path = `${SUBTITLES_DIR}/${dir}/original.${subtitle.language}.srt`;
          files.push({ path, bytes });
          packaged.subtitles.push({
            language: subtitle.language,
            path,
            sha256: sha256Hex(bytes),
            originalFilename: subtitle.originalFilename,
          });
          summary.subtitles += 1;
        }
      }
      if (episode.ready && (input.options.cards || input.options.audio)) {
        const cues = await deps.reader.listCues(episode.id);
        if (input.options.cards) {
          const cards = await deps.reader.listCatalogCards(episode.id);
          if (cards.length > 0) {
            const path = `${CARDS_DIR}/${dir}.json`;
            files.push({
              path,
              bytes: new TextEncoder().encode(
                JSON.stringify({ cards: cards.map(({ cueId: _cueId, ...card }) => card) }),
              ),
            });
            packaged.cardsPath = path;
            summary.cards += cards.length;
          }
        }
        if (input.options.audio) {
          for (const asset of await deps.reader.listAudioForTexts(cues.map((cue) => cue.text))) {
            const key = `${asset.voiceId}/${asset.textHash}`;
            if (audioSeen.has(key)) continue;
            const bytes = await deps.storage.read(asset.storagePath);
            if (!bytes) continue;
            audioSeen.add(key);
            const path = `${AUDIO_DIR}/${asset.voiceId}/${asset.textHash}.${asset.format}`;
            files.push({ path, bytes });
            audioIndex.push({
              path,
              textHash: asset.textHash,
              voiceId: asset.voiceId,
              language: asset.language,
              modelVersion: asset.modelVersion,
              format: asset.format,
            });
            summary.audio += 1;
          }
        }
      }
      packagedEpisodes.push(packaged);
    }

    const catalog: PackagedCatalog = {
      works: [
        {
          workKey,
          metadataProvider: work.metadataProvider,
          externalId: work.externalId,
          type: work.type,
          title: work.title,
          originalTitle: work.originalTitle,
          overview: work.overview,
          year: work.year,
          posterPath: work.posterPath,
          backdropPath: work.backdropPath,
          posterColors: work.posterColors,
          levelMin: work.levelMin,
          levelMax: work.levelMax,
          accent: work.accent,
          seasons: seasons
            .filter((season) =>
              packagedEpisodes.some((episode) => episode.seasonNumber === season.seasonNumber),
            )
            .map(({ seasonNumber, title, episodeCount }) => ({ seasonNumber, title, episodeCount })),
          episodes: packagedEpisodes,
        },
      ],
    };
    files.push({ path: CATALOG_PATH, bytes: new TextEncoder().encode(JSON.stringify(catalog)) });
    if (audioIndex.length > 0) {
      files.push({
        path: AUDIO_INDEX_PATH,
        bytes: new TextEncoder().encode(JSON.stringify({ assets: audioIndex })),
      });
    }
    const manifest: Manifest = {
      format: "deixa-package",
      version: PACKAGE_FORMAT_VERSION,
      generatedAt: deps.clock.now().toISOString(),
      app: { name: APP_NAME, version: APP_VERSION },
      entries: files.map((file) => ({
        path: file.path,
        sha256: sha256Hex(file.bytes),
        bytes: file.bytes.length,
      })),
    };
    files.unshift({ path: MANIFEST_PATH, bytes: new TextEncoder().encode(JSON.stringify(manifest)) });
    const scopeLabel =
      input.scope.kind === "work"
        ? ""
        : input.scope.kind === "season"
          ? `-t${input.scope.seasonNumber}`
          : `-t${episodes[0]?.seasonNumber}e${episodes[0]?.episodeNumber}`;
    return {
      filename: `${slug(work.title)}${scopeLabel}${PACKAGE_EXTENSION}`,
      bytes: await deps.archive.pack(files),
      summary,
    };
  };
}
