import { describe, expect, it } from "vitest";
import {
  activeCueIndex,
  findYoutubeVideoId,
  lyricsToVideoMs,
  parseYoutubeVideoId,
  videoToLyricsMs,
  type SongTiming,
} from "./timeline";

const timing: SongTiming = {
  leadInMs: 8000,
  pauses: [
    { atMs: 90_000, durationMs: 5000 },
    { atMs: 30_000, durationMs: 2000 },
  ],
};

describe("timeline", () => {
  it("soma atraso inicial e pausas já passadas", () => {
    expect(lyricsToVideoMs(0, timing)).toBe(8000);
    expect(lyricsToVideoMs(29_999, timing)).toBe(37_999);
    expect(lyricsToVideoMs(30_000, timing)).toBe(40_000);
    expect(lyricsToVideoMs(100_000, timing)).toBe(115_000);
  });

  it("converte do vídeo para a letra e para a letra parada durante a pausa", () => {
    expect(videoToLyricsMs(0, timing)).toBe(0);
    expect(videoToLyricsMs(8000, timing)).toBe(0);
    expect(videoToLyricsMs(38_000, timing)).toBe(30_000);
    expect(videoToLyricsMs(39_500, timing)).toBe(30_000);
    expect(videoToLyricsMs(40_000, timing)).toBe(30_000);
    expect(videoToLyricsMs(41_000, timing)).toBe(31_000);
  });

  it("ida e volta devolve o mesmo tempo da letra", () => {
    for (const lyrics of [0, 1, 29_999, 30_000, 45_000, 90_000, 120_000]) {
      expect(videoToLyricsMs(lyricsToVideoMs(lyrics, timing), timing)).toBe(lyrics);
    }
  });

  it("sem atraso nem pausas é a identidade", () => {
    const plain: SongTiming = { leadInMs: 0, pauses: [] };
    expect(lyricsToVideoMs(1234, plain)).toBe(1234);
    expect(videoToLyricsMs(1234, plain)).toBe(1234);
  });

  it("acha a fala ativa por busca binária", () => {
    const cues = [{ startMs: 1000 }, { startMs: 5000 }, { startMs: 9000 }];
    expect(activeCueIndex(cues, 0)).toBe(-1);
    expect(activeCueIndex(cues, 1000)).toBe(0);
    expect(activeCueIndex(cues, 4999)).toBe(0);
    expect(activeCueIndex(cues, 5000)).toBe(1);
    expect(activeCueIndex(cues, 99_000)).toBe(2);
    expect(activeCueIndex([], 10)).toBe(-1);
  });
});

describe("parseYoutubeVideoId", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}&t=42s&list=abc`,
    `https://youtu.be/${id}?si=xyz`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://music.youtube.com/watch?v=${id}&feature=share`,
    `m.youtube.com/watch?v=${id}`,
    id,
  ])("extrai o id de %s", (input) => {
    expect(parseYoutubeVideoId(input)).toBe(id);
  });

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=curto",
    "https://www.youtube.com/",
    "não é link",
    "",
  ])("recusa %s", (input) => {
    expect(findYoutubeVideoId(input)).toBeNull();
    expect(() => parseYoutubeVideoId(input)).toThrowError(/MUSIC_INVALID_VIDEO/);
  });
});
