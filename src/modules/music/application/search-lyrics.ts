import { MAX_SEARCH_RESULTS } from "../domain/music";
import type { LyricsCandidate, LyricsProvider, LyricsQuery } from "./ports";

const MAX_TERM = 120;

const clean = (value: string | undefined): string | undefined => {
  const text = value?.replace(/\s+/g, " ").trim().slice(0, MAX_TERM);
  return text ? text : undefined;
};

export function makeSearchLyrics(deps: { lyrics: LyricsProvider }) {
  return async function searchLyrics(input: LyricsQuery): Promise<LyricsCandidate[]> {
    const query = { query: clean(input.query), artist: clean(input.artist), title: clean(input.title) };
    if (!query.query && !query.artist && !query.title) return [];
    return (await deps.lyrics.search(query)).slice(0, MAX_SEARCH_RESULTS);
  };
}
