import { callAction } from "../call";

export async function ensureDefaultPlaylistAction() {
  return callAction("music.ensureDefault");
}

export async function createPlaylistAction(input: unknown) {
  return callAction("music.createPlaylist", input);
}

export async function searchLyricsAction(input: unknown) {
  return callAction("music.searchLyrics", input);
}

export async function addSongAction(input: unknown) {
  return callAction("music.addSong", input);
}

export async function removeSongAction(input: unknown) {
  return callAction("music.removeSong", input);
}

export async function saveSongTimingAction(input: unknown) {
  return callAction("music.saveTiming", input);
}

export async function requestSongTranslationAction(input: unknown) {
  return callAction("music.requestTranslation", input);
}
