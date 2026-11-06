"use server";

import { runOperation } from "../operations";

export async function ensureDefaultPlaylistAction() {
  return runOperation("music.ensureDefault");
}

export async function createPlaylistAction(input: unknown) {
  return runOperation("music.createPlaylist", input);
}

export async function searchLyricsAction(input: unknown) {
  return runOperation("music.searchLyrics", input);
}

export async function addSongAction(input: unknown) {
  return runOperation("music.addSong", input);
}

export async function removeSongAction(input: unknown) {
  return runOperation("music.removeSong", input);
}

export async function saveSongTimingAction(input: unknown) {
  return runOperation("music.saveTiming", input);
}

export async function requestSongTranslationAction(input: unknown) {
  return runOperation("music.requestTranslation", input);
}
