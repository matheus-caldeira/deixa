"use server";

import { runOperation } from "../operations";
import { uploadFromForm } from "../uploads";

export async function searchWorksAction(query: unknown) {
  return runOperation("catalog.searchWorks", query);
}

export async function selectWorkAction(input: unknown) {
  return runOperation("catalog.selectWork", input);
}

export async function openUploadTargetAction(mediaId: unknown) {
  return runOperation("catalog.openUploadTarget", mediaId);
}

export async function loadEpisodesAction(input: unknown) {
  return runOperation("catalog.loadEpisodes", input);
}

export async function uploadSubtitlesAction(form: FormData) {
  return runOperation("catalog.uploadSubtitles", {
    mediaId: form.get("mediaId"),
    episodeId: form.get("episodeId"),
    useSample: form.get("useSample") === "true",
    target: await uploadFromForm(form.get("target")),
    native: await uploadFromForm(form.get("native")),
    script: await uploadFromForm(form.get("script")),
  });
}

export async function searchSubtitlesAction(input: unknown) {
  return runOperation("catalog.searchSubtitles", input);
}

export async function importFromSourceAction(input: unknown) {
  return runOperation("catalog.importFromSource", input);
}

export async function refreshWorkAction(mediaId: unknown) {
  return runOperation("catalog.refreshWork", mediaId);
}

export async function studyEpisodeAction(episodeId: unknown) {
  return runOperation("catalog.studyEpisode", episodeId);
}

export async function openTmdbWorkAction(input: unknown) {
  return runOperation("catalog.openTmdbWork", input);
}

export async function rateWorkLevelAction(input: unknown) {
  return runOperation("catalog.rateWorkLevel", input);
}
