import { sha256Hex } from "@/shared/hash";
import type { PackagedCard } from "../../domain/package";
import type {
  CueRef,
  ExportableAudio,
  ExportableEpisode,
  ExportableSeason,
  ExportableSubtitle,
  ExportableWork,
  LocalWork,
  PackageArchive,
  PackageCatalogReader,
  PackageCatalogWriter,
  PackageFile,
} from "../ports";

export class JsonArchive implements PackageArchive {
  async pack(files: PackageFile[]): Promise<Uint8Array> {
    const encoded = files.map((file) => ({ path: file.path, bytes: Array.from(file.bytes) }));
    return new TextEncoder().encode(JSON.stringify(encoded));
  }

  async unpack(bytes: Uint8Array): Promise<PackageFile[]> {
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as { path: string; bytes: number[] }[];
    return decoded.map((file) => ({ path: file.path, bytes: Uint8Array.from(file.bytes) }));
  }
}

type Episode = ExportableEpisode & {
  subtitles: ExportableSubtitle[];
  cues: CueRef[];
  cards: (PackagedCard & { cueId: string })[];
};

export class InMemoryPackageCatalog implements PackageCatalogReader, PackageCatalogWriter {
  works = new Map<string, ExportableWork>();
  seasons = new Map<string, ExportableSeason[]>();
  episodes = new Map<string, Episode[]>();
  audio: ExportableAudio[] = [];
  imported: { episodeId: string; english: string; portuguese: string | null }[] = [];
  conflicts = new Set<string>();
  private counter = 0;

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  async findWork(mediaId: string): Promise<ExportableWork | null> {
    return this.works.get(mediaId) ?? null;
  }

  async findWorkByExternal(metadataProvider: string, externalId: string): Promise<LocalWork | null> {
    const work = [...this.works.values()].find(
      (candidate) => candidate.metadataProvider === metadataProvider && candidate.externalId === externalId,
    );
    if (!work) return null;
    const ready = (this.episodes.get(work.id) ?? []).filter((episode) => episode.ready);
    return {
      mediaId: work.id,
      title: work.title,
      readyEpisodes: new Set(ready.map((episode) => `s${episode.seasonNumber}e${episode.episodeNumber}`)),
    };
  }

  async listSeasons(mediaId: string): Promise<ExportableSeason[]> {
    return this.seasons.get(mediaId) ?? [];
  }

  async listEpisodes(mediaId: string): Promise<ExportableEpisode[]> {
    return (this.episodes.get(mediaId) ?? []).map(
      ({ subtitles: _s, cues: _c, cards: _k, ...episode }) => episode,
    );
  }

  private episode(episodeId: string): Episode | undefined {
    return [...this.episodes.values()].flat().find((episode) => episode.id === episodeId);
  }

  async listSubtitles(episodeId: string): Promise<ExportableSubtitle[]> {
    return this.episode(episodeId)?.subtitles ?? [];
  }

  async listEnglishCues(episodeId: string): Promise<CueRef[]> {
    return this.episode(episodeId)?.cues ?? [];
  }

  async listCatalogCards(episodeId: string): Promise<(PackagedCard & { cueId: string })[]> {
    return this.episode(episodeId)?.cards ?? [];
  }

  async listAudioForTexts(texts: string[]): Promise<ExportableAudio[]> {
    const wanted = new Set(texts.map((text) => sha256Hex(text)));
    return this.audio.filter((asset) => wanted.has(asset.textHash));
  }

  async ensureWork(work: Parameters<PackageCatalogWriter["ensureWork"]>[0]) {
    const existing = await this.findWorkByExternal(work.metadataProvider, work.externalId);
    const mediaId = existing?.mediaId ?? this.nextId("media");
    if (!existing) {
      const { seasons, episodes, createdBy: _by, now: _now, ...rest } = work;
      this.works.set(mediaId, { ...rest, id: mediaId });
      this.seasons.set(
        mediaId,
        seasons.map((season) => ({ ...season, id: this.nextId("season") })),
      );
      this.episodes.set(
        mediaId,
        episodes.map((episode) => ({
          ...episode,
          id: this.nextId("ep"),
          ready: false,
          subtitles: [],
          cues: [],
          cards: [],
        })),
      );
    }
    const episodeIds = new Map(
      (this.episodes.get(mediaId) ?? []).map((episode) => [
        `s${episode.seasonNumber}e${episode.episodeNumber}`,
        episode.id,
      ]),
    );
    return { mediaId, created: !existing, episodeIds };
  }

  async importSubtitles(input: Parameters<PackageCatalogWriter["importSubtitles"]>[0]) {
    const episode = this.episode(input.episodeId);
    if (!episode) throw new Error("episódio inexistente");
    if (this.conflicts.has(input.episodeId)) {
      const { AppError } = await import("@/shared/errors");
      throw new AppError("SUBTITLE_VERSION_CONFLICT");
    }
    if (episode.ready) return "DUPLICATE" as const;
    episode.ready = true;
    const text = new TextDecoder().decode(input.english.bytes);
    episode.cues = text
      .split("\n")
      .map((line, index) => ({ id: this.nextId("cue"), sequence: index + 1, text: line }));
    this.imported.push({
      episodeId: input.episodeId,
      english: text,
      portuguese: input.portuguese ? new TextDecoder().decode(input.portuguese.bytes) : null,
    });
    return "PROCESSED" as const;
  }

  async createCatalogCard(input: { episodeId: string; cueId: string; card: PackagedCard }): Promise<void> {
    this.episode(input.episodeId)?.cards.push({ ...input.card, cueId: input.cueId });
  }

  async saveAudio(asset: ExportableAudio & { id: string }): Promise<void> {
    this.audio.push(asset);
  }
}
