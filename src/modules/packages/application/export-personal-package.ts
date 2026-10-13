import { APP_NAME, APP_VERSION } from "@/shared/app";
import type { Clock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import { sha256Hex } from "@/shared/hash";
import {
  CATALOG_PATH,
  MANIFEST_PATH,
  PACKAGE_EXTENSION,
  PACKAGE_FORMAT_VERSION,
  workKeyOf,
  type Manifest,
  type PackagedCatalog,
} from "../domain/package";
import { PERSONAL_META_PATH, PERSONAL_PATH, type PersonalMeta } from "../domain/personal";
import type { ExportedPackage } from "./export-package";
import type {
  AccountGate,
  PackageArchive,
  PackageCatalogReader,
  PackageFile,
  PersonalCipher,
  PersonalDataReader,
} from "./ports";

type Deps = {
  reader: PackageCatalogReader;
  personal: PersonalDataReader;
  cipher: PersonalCipher;
  account: AccountGate;
  archive: PackageArchive;
  clock: Clock;
};

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

export function makeExportPersonalPackage(deps: Deps) {
  return async function exportPersonalPackage(input: {
    userId: string;
    password: string;
    includeCredentials: boolean;
  }): Promise<ExportedPackage> {
    const email = await deps.account.emailOf(input.userId);
    if (!email || !(await deps.account.verifyPassword(input.userId, input.password))) {
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Senha incorreta. A exportação pessoal pede a senha da sua conta.",
      );
    }
    const data = { ...(await deps.personal.collect(input.userId, input.includeCredentials)), email };
    const works: PackagedCatalog["works"] = [];
    for (const ref of await deps.personal.listReferencedWorks(input.userId)) {
      const work = await deps.reader.findWork(ref.mediaId);
      if (!work) continue;
      const seasons = await deps.reader.listSeasons(work.id);
      const episodes = await deps.reader.listEpisodes(work.id);
      works.push({
        workKey: workKeyOf(work.metadataProvider, work.externalId),
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
        seasons: seasons.map(({ seasonNumber, title, episodeCount }) => ({
          seasonNumber,
          title,
          episodeCount,
        })),
        episodes: episodes.map((episode) => ({
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          title: episode.title,
          overview: episode.overview,
          durationSeconds: episode.durationSeconds,
          stillPath: episode.stillPath,
          subtitles: [],
          cardsPath: null,
        })),
      });
    }
    const meta: PersonalMeta = {
      email,
      exportedAt: data.exportedAt,
      includesCredentials: input.includeCredentials && data.credentials.length > 0,
    };
    const files: PackageFile[] = [
      { path: CATALOG_PATH, bytes: encode({ works }) },
      { path: PERSONAL_META_PATH, bytes: encode(meta) },
      { path: PERSONAL_PATH, bytes: await deps.cipher.seal(encode(data), email, input.password) },
    ];
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
    files.unshift({ path: MANIFEST_PATH, bytes: encode(manifest) });
    const stamp = deps.clock.now().toISOString().slice(0, 10);
    return {
      filename: `meus-dados-${stamp}${PACKAGE_EXTENSION}`,
      bytes: await deps.archive.pack(files),
      summary: { episodes: 0, subtitles: 0, cards: data.cards.length, audio: 0 },
    };
  };
}
