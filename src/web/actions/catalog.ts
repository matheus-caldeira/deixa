import { callAction } from "../call";
import { uploadFromForm } from "../uploads";

export async function searchWorksAction(query: unknown) {
  return callAction("catalog.searchWorks", query);
}

export async function selectWorkAction(input: unknown) {
  return callAction("catalog.selectWork", input);
}

export async function openUploadTargetAction(mediaId: unknown) {
  return callAction("catalog.openUploadTarget", mediaId);
}

export async function loadEpisodesAction(input: unknown) {
  return callAction("catalog.loadEpisodes", input);
}

export async function searchSubtitlesAction(input: unknown) {
  return callAction("catalog.searchSubtitles", input);
}

export async function importFromSourceAction(input: unknown) {
  return callAction("catalog.importFromSource", input);
}

export async function refreshWorkAction(mediaId: unknown) {
  return callAction("catalog.refreshWork", mediaId);
}

export async function studyEpisodeAction(episodeId: unknown) {
  return callAction("catalog.studyEpisode", episodeId);
}

export async function openTmdbWorkAction(input: unknown) {
  return callAction("catalog.openTmdbWork", input);
}

export async function rateWorkLevelAction(input: unknown) {
  return callAction("catalog.rateWorkLevel", input);
}

export async function uploadSubtitlesAction(form: FormData) {
  return callAction("catalog.uploadSubtitles", {
    mediaId: form.get("mediaId"),
    episodeId: form.get("episodeId"),
    useSample: form.get("useSample") === "true",
    target: await uploadFromForm(form.get("target")),
    native: await uploadFromForm(form.get("native")),
    script: await uploadFromForm(form.get("script")),
  });
}
