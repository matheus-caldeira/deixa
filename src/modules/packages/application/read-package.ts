import { AppError } from "@/shared/errors";
import { sha256Hex } from "@/shared/hash";
import {
  AUDIO_INDEX_PATH,
  CATALOG_PATH,
  MANIFEST_PATH,
  MAX_JSON_BYTES,
  MAX_PACKAGE_BYTES,
  MAX_PACKAGE_FILES,
  MAX_SUBTITLE_BYTES,
  PACKAGE_FORMAT_VERSION,
  manifestSchema,
  packagedAudioIndexSchema,
  packagedCardsSchema,
  packagedCatalogSchema,
  type Manifest,
  type PackagedAudio,
  type PackagedCard,
  type PackagedCatalog,
} from "../domain/package";
import {
  MAX_PERSONAL_BYTES,
  PERSONAL_META_PATH,
  PERSONAL_PATH,
  personalMetaSchema,
  type PersonalMeta,
} from "../domain/personal";
import type { PackageArchive, PackageFile } from "./ports";

export type ReadPackage = {
  manifest: Manifest;
  catalog: PackagedCatalog;
  audio: PackagedAudio[];
  files: Map<string, Uint8Array>;
  personal: { meta: PersonalMeta; sealed: Uint8Array } | null;
  cardsAt(path: string): PackagedCard[];
};

const INVALID = (detail: string) =>
  new AppError("INVALID_INPUT", `Este arquivo não é um pacote válido do Deixa: ${detail}.`);

function parseJson<T>(
  bytes: Uint8Array,
  parse: (value: unknown) => { success: true; data: T } | { success: false },
  what: string,
): T {
  if (bytes.length > MAX_JSON_BYTES) throw INVALID(`${what} grande demais`);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw INVALID(`${what} ilegível`);
  }
  const parsed = parse(value);
  if (!parsed.success) throw INVALID(`${what} fora do formato`);
  return parsed.data;
}

export async function readPackage(archive: PackageArchive, bytes: Uint8Array): Promise<ReadPackage> {
  if (bytes.length > MAX_PACKAGE_BYTES) throw INVALID("arquivo grande demais");
  let entries: PackageFile[];
  try {
    entries = await archive.unpack(bytes);
  } catch {
    throw INVALID("não é um ZIP");
  }
  if (entries.length > MAX_PACKAGE_FILES) throw INVALID("arquivos demais");
  const files = new Map(entries.map((entry) => [entry.path, entry.bytes]));
  const manifestBytes = files.get(MANIFEST_PATH);
  if (!manifestBytes) throw INVALID("sem manifesto");
  const manifest = parseJson(manifestBytes, (value) => manifestSchema.safeParse(value), "manifesto");
  if (manifest.version > PACKAGE_FORMAT_VERSION) {
    throw new AppError(
      "INVALID_INPUT",
      "Este pacote foi gerado por uma versão mais nova do Deixa. Atualize o app.",
    );
  }
  const trusted = new Map<string, Uint8Array>();
  for (const entry of manifest.entries) {
    const content = files.get(entry.path);
    if (!content) throw INVALID(`falta ${entry.path}`);
    if (content.length !== entry.bytes || sha256Hex(content) !== entry.sha256) {
      throw INVALID(`${entry.path} foi alterado`);
    }
    trusted.set(entry.path, content);
  }
  const catalogBytes = trusted.get(CATALOG_PATH);
  if (!catalogBytes) throw INVALID("sem catálogo");
  const catalog = parseJson(catalogBytes, (value) => packagedCatalogSchema.safeParse(value), "catálogo");
  for (const work of catalog.works) {
    for (const episode of work.episodes) {
      for (const subtitle of episode.subtitles) {
        const content = trusted.get(subtitle.path);
        if (!content) throw INVALID(`falta a legenda ${subtitle.path}`);
        if (content.length > MAX_SUBTITLE_BYTES) throw INVALID("legenda grande demais");
        if (sha256Hex(content) !== subtitle.sha256) throw INVALID(`legenda ${subtitle.path} alterada`);
      }
      if (episode.cardsPath && !trusted.has(episode.cardsPath))
        throw INVALID(`faltam os cards ${episode.cardsPath}`);
    }
  }
  const audioIndexBytes = trusted.get(AUDIO_INDEX_PATH);
  const audio = audioIndexBytes
    ? parseJson(audioIndexBytes, (value) => packagedAudioIndexSchema.safeParse(value), "índice de áudio")
        .assets
    : [];
  for (const asset of audio) if (!trusted.has(asset.path)) throw INVALID(`falta o áudio ${asset.path}`);
  const metaBytes = trusted.get(PERSONAL_META_PATH);
  const sealed = trusted.get(PERSONAL_PATH);
  let personal: ReadPackage["personal"] = null;
  if (metaBytes && sealed) {
    if (sealed.length > MAX_PERSONAL_BYTES) throw INVALID("dados pessoais grandes demais");
    personal = {
      meta: parseJson(metaBytes, (value) => personalMetaSchema.safeParse(value), "dados pessoais"),
      sealed,
    };
  }
  return {
    manifest,
    catalog,
    audio,
    files: trusted,
    personal,
    cardsAt: (path) => {
      const content = trusted.get(path);
      if (!content) return [];
      return parseJson(content, (value) => packagedCardsSchema.safeParse(value), "cards").cards;
    },
  };
}
