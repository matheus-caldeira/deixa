import type { EpisodeScript } from "@/modules/subtitles";
import type { StudyLanguage } from "@/shared/study-languages";
import { AppError } from "@/shared/errors";
import type { Playlist, Song, SongEntry, SongTranslationSource } from "../../domain/music";
import type { SongTiming } from "../../domain/timeline";
import type {
  MusicRepository,
  NewPlaylist,
  NewSong,
  SongCue,
  SongSubtitles,
  SongSubtitleUpload,
} from "../ports";

type Stored = SongEntry & { playlistId: string };

export class InMemoryMusicRepository implements MusicRepository {
  readonly playlists = new Map<string, Playlist & { externalId: string }>();
  readonly songs = new Map<string, Stored>();
  readonly onCreate: (episodeId: string) => void;

  constructor(onCreate: (episodeId: string) => void = () => undefined) {
    this.onCreate = onCreate;
  }

  private withCount(playlist: Playlist & { externalId: string }): Playlist {
    const { externalId: _externalId, ...rest } = playlist;
    return {
      ...rest,
      songCount: [...this.songs.values()].filter((song) => song.playlistId === playlist.id).length,
    };
  }

  async ensurePlaylist(input: NewPlaylist): Promise<Playlist> {
    const known = [...this.playlists.values()].find((playlist) => playlist.externalId === input.externalId);
    if (known) return this.withCount(known);
    const created = {
      id: input.id,
      externalId: input.externalId,
      title: input.title,
      overview: input.overview,
      createdBy: input.createdBy,
      createdByName: null,
      songCount: 0,
    };
    this.playlists.set(created.id, created);
    return this.withCount(created);
  }

  async findPlaylist(playlistId: string): Promise<Playlist | null> {
    const playlist = this.playlists.get(playlistId);
    return playlist ? this.withCount(playlist) : null;
  }

  async listPlaylists(): Promise<Playlist[]> {
    return [...this.playlists.values()].map((playlist) => this.withCount(playlist));
  }

  async countPlaylistsBy(userId: string): Promise<number> {
    return [...this.playlists.values()].filter((playlist) => playlist.createdBy === userId).length;
  }

  async listSongs(playlistId: string): Promise<SongEntry[]> {
    return [...this.songs.values()]
      .filter((song) => song.playlistId === playlistId)
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  async findSong(episodeId: string) {
    const song = this.songs.get(episodeId);
    const playlist = song ? await this.findPlaylist(song.playlistId) : null;
    return song && playlist ? { ...song, playlist } : null;
  }

  async findSongByVideo(playlistId: string, youtubeVideoId: string): Promise<SongEntry | null> {
    return (
      [...this.songs.values()].find(
        (song) => song.playlistId === playlistId && song.youtubeVideoId === youtubeVideoId,
      ) ?? null
    );
  }

  async createSong(input: NewSong) {
    const existing = await this.findSongByVideo(input.playlistId, input.song.youtubeVideoId);
    if (existing) return { episodeId: existing.episodeId, created: false };
    const number = (await this.listSongs(input.playlistId)).length + 1;
    this.songs.set(input.episodeId, {
      ...input.song,
      episodeId: input.episodeId,
      mediaItemId: input.playlistId,
      playlistId: input.playlistId,
      episodeNumber: number,
      status: "NONE",
      cueCount: 0,
      subtitleLanguages: [],
    });
    this.onCreate(input.episodeId);
    return { episodeId: input.episodeId, created: true };
  }

  async removeSong(episodeId: string): Promise<void> {
    this.songs.delete(episodeId);
  }

  async updateTiming(episodeId: string, timing: SongTiming): Promise<void> {
    const song = this.songs.get(episodeId);
    if (song) this.songs.set(episodeId, { ...song, ...timing });
  }

  async updateTranslationSource(episodeId: string, source: SongTranslationSource): Promise<void> {
    const song = this.songs.get(episodeId);
    if (song) this.songs.set(episodeId, { ...song, translationSource: source });
  }

  async listTracks(playlistId: string): Promise<Song[]> {
    return (await this.listSongs(playlistId)).map(
      ({ episodeNumber: _n, status: _s, cueCount: _c, subtitleLanguages: _l, ...song }) => song,
    );
  }

  async upsertTrack(): Promise<void> {
    throw new AppError("INVALID_INPUT");
  }
}

export class InMemorySongSubtitles implements SongSubtitles {
  readonly files = new Map<string, { bytes: Uint8Array; cues: SongCue[] }>();
  imports: { episodeId: string; languages: StudyLanguage[] }[] = [];
  failWith: Error | null = null;

  constructor(private readonly music: InMemoryMusicRepository) {}

  private key(episodeId: string, language: StudyLanguage): string {
    return `${episodeId}:${language}`;
  }

  private store(episodeId: string, upload: SongSubtitleUpload): void {
    const blocks = new TextDecoder().decode(upload.upload.bytes).trim().split(/\n\n+/);
    const cues = blocks.map((block, index) => {
      const lines = block.split("\n");
      const [start = "", end = ""] = (lines[1] ?? "").split(" --> ");
      const toMs = (value: string) => {
        const [h = "0", m = "0", rest = "0,0"] = value.split(":");
        const [s = "0", ms = "0"] = rest.split(",");
        return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(ms);
      };
      return {
        id: `${episodeId}:${upload.language}:${index + 1}`,
        sequence: index + 1,
        startMs: toMs(start),
        endMs: toMs(end),
        text: lines.slice(2).join(" "),
      };
    });
    this.files.set(this.key(episodeId, upload.language), { bytes: upload.upload.bytes, cues });
  }

  async importSubtitles(input: Parameters<SongSubtitles["importSubtitles"]>[0]) {
    if (this.failWith) throw this.failWith;
    this.store(input.episodeId, input.target);
    if (input.native) this.store(input.episodeId, input.native);
    const languages = [input.target.language, ...(input.native ? [input.native.language] : [])];
    this.imports.push({ episodeId: input.episodeId, languages });
    const cueCount = this.files.get(this.key(input.episodeId, input.target.language))?.cues.length ?? 0;
    const song = this.music.songs.get(input.episodeId);
    if (song) {
      this.music.songs.set(input.episodeId, {
        ...song,
        status: "READY",
        cueCount,
        subtitleLanguages: languages,
      });
    }
    return { outcome: "PROCESSED" as const, cueCount };
  }

  async listCues(episodeId: string, language: StudyLanguage) {
    return this.files.get(this.key(episodeId, language))?.cues ?? null;
  }

  async readOriginal(episodeId: string, language: StudyLanguage) {
    return this.files.get(this.key(episodeId, language))?.bytes ?? null;
  }

  async script(episodeId: string, pair: { target: StudyLanguage; native: StudyLanguage }) {
    const target = this.files.get(this.key(episodeId, pair.target));
    if (!target) return null;
    const native = this.files.get(this.key(episodeId, pair.native));
    const script: EpisodeScript = {
      episodeId,
      pair,
      targetFileId: "file",
      hasNative: Boolean(native),
      lines: target.cues.map((cue, index) => ({
        cueId: cue.id,
        sequence: cue.sequence,
        startMs: cue.startMs,
        endMs: cue.endMs,
        text: cue.text,
        sceneIndex: 0,
        startsScene: index === 0,
        translation: native?.cues[index]?.text ?? null,
        translationSource: native ? ("subtitle_pt" as const) : null,
      })),
    };
    return script;
  }
}
