export * from "./domain/music";
export * from "./domain/lrc";
export * from "./domain/timeline";
export {
  alignPastedTranslation,
  applyTranslatedLines,
  translatedSongLinesSchema,
} from "./domain/translation";
export type {
  LyricsCandidate,
  LyricsDocument,
  LyricsProvider,
  LyricsQuery,
  MusicRepository,
  NewPlaylist,
  NewSong,
  PlaylistSummary,
  ResolveSongLlm,
  SongCue,
  SongLlm,
  SongSubtitleUpload,
  SongSubtitles,
} from "./application/ports";
export { makeEnsureDefaultPlaylist } from "./application/ensure-default-playlist";
export { makeCreatePlaylist } from "./application/create-playlist";
export { makeListPlaylists } from "./application/list-playlists";
export { makeGetPlaylist, type PlaylistView } from "./application/get-playlist";
export { makeSearchLyrics } from "./application/search-lyrics";
export { makeAddSong, type AddSongInput, type AddSongResult, type LyricsInput } from "./application/add-song";
export { makeRemoveSong } from "./application/remove-song";
export { makeUpdateSongTiming } from "./application/update-song-timing";
export { makeGetSongPlayer, type PlayerCue, type SongPlayer } from "./application/get-song-player";
export {
  makeRequestSongTranslation,
  makeTranslateSong,
  type TranslateOutcome,
} from "./application/translate-song";
