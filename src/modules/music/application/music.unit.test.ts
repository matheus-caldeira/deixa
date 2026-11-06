import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { AppError } from "@/shared/errors";
import type { LanguagePair } from "@/shared/study-languages";
import { FakeLyricsProvider } from "../infrastructure/fake-lyrics-provider";
import { makeAddSong, type AddSongInput } from "./add-song";
import { makeCreatePlaylist } from "./create-playlist";
import { makeEnsureDefaultPlaylist } from "./ensure-default-playlist";
import { makeGetPlaylist } from "./get-playlist";
import { makeGetSongPlayer } from "./get-song-player";
import { makeListPlaylists } from "./list-playlists";
import { makeRemoveSong } from "./remove-song";
import { makeSearchLyrics } from "./search-lyrics";
import { makeRequestSongTranslation, makeTranslateSong } from "./translate-song";
import { makeUpdateSongTiming } from "./update-song-timing";
import { InMemoryMusicRepository, InMemorySongSubtitles } from "./testing/fakes";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const pair: LanguagePair = { target: "en", native: "pt-BR" };
const VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function build() {
  let counter = 0;
  const ids = { next: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}` };
  const clock = new FixedClock(new Date("2026-11-06T12:00:00Z"));
  const music = new InMemoryMusicRepository();
  const subtitles = new InMemorySongSubtitles(music);
  const lyrics = new FakeLyricsProvider();
  const llmCalls: number[] = [];
  const llm = {
    translateLines: async (lines: { id: string; text: string }[]) => {
      llmCalls.push(lines.length);
      return lines.map((line) => ({ id: line.id, translation: `PT ${line.text}` }));
    },
  };
  return {
    music,
    subtitles,
    llmCalls,
    ensureDefault: makeEnsureDefaultPlaylist({ music, clock, ids }),
    createPlaylist: makeCreatePlaylist({ music, clock, ids }),
    listPlaylists: makeListPlaylists({ music }),
    getPlaylist: makeGetPlaylist({ music }),
    search: makeSearchLyrics({ lyrics }),
    addSong: makeAddSong({ music, subtitles, lyrics, ids, clock }),
    removeSong: makeRemoveSong({ music }),
    updateTiming: makeUpdateSongTiming({ music }),
    player: makeGetSongPlayer({ music, subtitles }),
    requestTranslation: makeRequestSongTranslation({ music, subtitles }),
    translate: makeTranslateSong({ music, subtitles, resolveLlm: async () => llm }),
  };
}

function songInput(playlistId: string, overrides: Partial<AddSongInput> = {}): AddSongInput {
  return {
    userId: OWNER,
    isAdmin: false,
    playlistId,
    videoUrl: VIDEO,
    artist: "Lanterna Azul",
    title: "Morning Window",
    pair,
    lyrics: { kind: "provider", lyricsId: "fake-1" },
    translateWithAi: true,
    ...overrides,
  };
}

describe("playlists", () => {
  let app: ReturnType<typeof build>;
  beforeEach(() => {
    app = build();
  });

  it("cria a playlist padrão uma única vez por conta", async () => {
    const first = await app.ensureDefault({ userId: OWNER, language: "en" });
    const second = await app.ensureDefault({ userId: OWNER, language: "en" });
    const other = await app.ensureDefault({ userId: OTHER, language: "en" });
    expect(second.id).toBe(first.id);
    expect(other.id).not.toBe(first.id);
    expect(first.title).toBe("Minhas músicas");
  });

  it("cria playlist com título limpo e recusa título vazio", async () => {
    const playlist = await app.createPlaylist({
      userId: OWNER,
      title: "  Treino   de  manhã ",
      language: "en",
    });
    expect(playlist.title).toBe("Treino de manhã");
    await expect(app.createPlaylist({ userId: OWNER, title: "   ", language: "en" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("lista as próprias primeiro", async () => {
    await app.ensureDefault({ userId: OTHER, language: "en" });
    await app.ensureDefault({ userId: OWNER, language: "en" });
    const list = await app.listPlaylists({ userId: OWNER });
    expect(list.map((playlist) => playlist.owned)).toEqual([true, false]);
  });

  it("playlist inexistente responde como não encontrada", async () => {
    await expect(
      app.getPlaylist({ userId: OWNER, isAdmin: false, playlistId: "99999999-9999-4999-8999-999999999999" }),
    ).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
  });
});

describe("busca de letras", () => {
  it("devolve candidatas do provider e ignora busca vazia", async () => {
    const app = build();
    expect((await app.search({ artist: "Lanterna" })).length).toBe(2);
    expect(await app.search({})).toEqual([]);
    expect(await app.search({ query: "nada parecido" })).toEqual([]);
  });
});

describe("adicionar música", () => {
  let app: ReturnType<typeof build>;
  let playlistId: string;
  beforeEach(async () => {
    app = build();
    playlistId = (await app.ensureDefault({ userId: OWNER, language: "en" })).id;
  });

  it("importa a letra, deixa a música pronta e pede a tradução", async () => {
    const result = await app.addSong(songInput(playlistId));
    expect(result).toMatchObject({ created: true, translationPending: true, translationSource: "none" });
    expect(result.cueCount).toBeGreaterThan(5);
    const song = app.music.songs.get(result.episodeId);
    expect(song).toMatchObject({ status: "READY", youtubeVideoId: "dQw4w9WgXcQ", lyricsSource: "fake" });
    expect(app.subtitles.imports[0]?.languages).toEqual(["en"]);
  });

  it("o mesmo vídeo duas vezes não duplica a música", async () => {
    const first = await app.addSong(songInput(playlistId));
    const second = await app.addSong(songInput(playlistId, { videoUrl: "https://youtu.be/dQw4w9WgXcQ" }));
    expect(second.created).toBe(false);
    expect(second.episodeId).toBe(first.episodeId);
    expect(second.translationPending).toBe(false);
    expect(app.music.songs.size).toBe(1);
    expect(app.subtitles.imports).toHaveLength(1);
  });

  it("aceita LRC colado e tradução colada sem pedir IA", async () => {
    const result = await app.addSong(
      songInput(playlistId, {
        lyrics: { kind: "lrc", text: "[00:01.00]Hello there\n[00:05.00]Good night" },
        translationText: "Olá\nBoa noite",
      }),
    );
    expect(result).toMatchObject({ translationSource: "manual", translationPending: false, cueCount: 2 });
    expect(app.music.songs.get(result.episodeId)).toMatchObject({
      lyricsSource: "manual",
      translationSource: "manual",
    });
    expect(app.subtitles.imports[0]?.languages).toEqual(["en", "pt-BR"]);
  });

  it("não pede IA quando o usuário desliga ou os idiomas coincidem", async () => {
    const off = await app.addSong(songInput(playlistId, { translateWithAi: false }));
    expect(off.translationPending).toBe(false);
  });

  it("recusa link inválido, letra sem tempo e tradução com linhas a menos", async () => {
    await expect(
      app.addSong(songInput(playlistId, { videoUrl: "https://exemplo.com/x" })),
    ).rejects.toMatchObject({
      code: "MUSIC_INVALID_VIDEO",
    });
    await expect(
      app.addSong(songInput(playlistId, { lyrics: { kind: "provider", lyricsId: "inexistente" } })),
    ).rejects.toMatchObject({ code: "MUSIC_LYRICS_UNAVAILABLE" });
    await expect(
      app.addSong(songInput(playlistId, { lyrics: { kind: "lrc", text: "sem tempo" } })),
    ).rejects.toMatchObject({ code: "SUBTITLE_INVALID" });
    await expect(
      app.addSong(
        songInput(playlistId, {
          lyrics: { kind: "lrc", text: "[00:01.00]a\n[00:03.00]b" },
          translationText: "só uma",
        }),
      ),
    ).rejects.toMatchObject({ code: "MUSIC_TRANSLATION_MISMATCH" });
    expect(app.music.songs.size).toBe(0);
  });

  it("desfaz a música quando a importação falha", async () => {
    app.subtitles.failWith = new AppError("SUBTITLE_INVALID", "noCues");
    await expect(app.addSong(songInput(playlistId))).rejects.toMatchObject({ code: "SUBTITLE_INVALID" });
    expect(app.music.songs.size).toBe(0);
  });

  it("refaz a música que ficou sem letra por uma queda anterior", async () => {
    app.subtitles.failWith = null;
    const first = await app.addSong(songInput(playlistId));
    const stored = app.music.songs.get(first.episodeId);
    if (stored) app.music.songs.set(first.episodeId, { ...stored, status: "NONE" });
    const again = await app.addSong(songInput(playlistId));
    expect(again.created).toBe(true);
    expect(again.episodeId).not.toBe(first.episodeId);
    expect(app.music.songs.size).toBe(1);
  });
});

describe("autorização", () => {
  it("só o criador ou o administrador edita", async () => {
    const app = build();
    const playlistId = (await app.ensureDefault({ userId: OWNER, language: "en" })).id;
    await expect(app.addSong(songInput(playlistId, { userId: OTHER }))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const added = await app.addSong(songInput(playlistId));
    const stranger = { userId: OTHER, isAdmin: false, episodeId: added.episodeId };
    await expect(app.removeSong(stranger)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      app.updateTiming({ ...stranger, timing: { leadInMs: 1000, pauses: [] } }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(app.requestTranslation({ ...stranger, pair })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const view = await app.getPlaylist({ userId: OTHER, isAdmin: false, playlistId });
    expect(view.canEdit).toBe(false);
    const adminView = await app.getPlaylist({ userId: OTHER, isAdmin: true, playlistId });
    expect(adminView.canEdit).toBe(true);
    await app.removeSong({ ...stranger, isAdmin: true });
    expect(app.music.songs.size).toBe(0);
  });

  it("música inexistente responde como não encontrada", async () => {
    const app = build();
    await expect(
      app.removeSong({ userId: OWNER, isAdmin: false, episodeId: "99999999-9999-4999-8999-999999999999" }),
    ).rejects.toMatchObject({ code: "EPISODE_NOT_FOUND" });
  });
});

describe("sincronia e player", () => {
  it("salva atraso e pausas ordenadas e entrega no player", async () => {
    const app = build();
    const playlistId = (await app.ensureDefault({ userId: OWNER, language: "en" })).id;
    const { episodeId } = await app.addSong(songInput(playlistId));
    const saved = await app.updateTiming({
      userId: OWNER,
      isAdmin: false,
      episodeId,
      timing: {
        leadInMs: 7500,
        pauses: [
          { atMs: 40_000, durationMs: 3000 },
          { atMs: 10_000, durationMs: 2000 },
        ],
      },
    });
    expect(saved.pauses.map((pause) => pause.atMs)).toEqual([10_000, 40_000]);
    const player = await app.player({ userId: OWNER, isAdmin: false, episodeId, pair });
    expect(player.timing.leadInMs).toBe(7500);
    expect(player.youtubeVideoId).toBe("dQw4w9WgXcQ");
    expect(player.canEdit).toBe(true);
    expect(player.hasNative).toBe(false);
    expect(player.cues[0]?.text).toBe("The light comes in through the window");
  });

  it("recusa tempos fora dos limites", async () => {
    const app = build();
    const playlistId = (await app.ensureDefault({ userId: OWNER, language: "en" })).id;
    const { episodeId } = await app.addSong(songInput(playlistId));
    await expect(
      app.updateTiming({ userId: OWNER, isAdmin: false, episodeId, timing: { leadInMs: -1, pauses: [] } }),
    ).rejects.toBeTruthy();
  });
});

describe("tradução por IA", () => {
  it("traduz em uma chamada, herda os tempos e é idempotente", async () => {
    const app = build();
    const playlistId = (await app.ensureDefault({ userId: OWNER, language: "en" })).id;
    const { episodeId } = await app.addSong(songInput(playlistId));
    const first = await app.translate({ userId: OWNER, episodeId, pair });
    expect(first.outcome).toBe("translated");
    expect(app.llmCalls).toHaveLength(1);
    expect(app.music.songs.get(episodeId)?.translationSource).toBe("llm");
    const player = await app.player({ userId: OWNER, isAdmin: false, episodeId, pair });
    expect(player.hasNative).toBe(true);
    expect(player.translationSource).toBe("llm");
    expect(player.cues[0]?.translation).toBe("PT The light comes in through the window");

    const second = await app.translate({ userId: OWNER, episodeId, pair });
    expect(second.outcome).toBe("skipped");
    expect(app.llmCalls).toHaveLength(1);
    expect((await app.requestTranslation({ userId: OWNER, isAdmin: false, episodeId, pair })).schedule).toBe(
      false,
    );
  });

  it("saída inválida da IA vira erro tratável e não grava nada", async () => {
    const app = build();
    const playlistId = (await app.ensureDefault({ userId: OWNER, language: "en" })).id;
    const { episodeId } = await app.addSong(songInput(playlistId));
    const broken = makeTranslateSong({
      music: app.music,
      subtitles: app.subtitles,
      resolveLlm: async () => ({ translateLines: async () => ({ not: "a list" }) }),
    });
    await expect(broken({ userId: OWNER, episodeId, pair })).rejects.toMatchObject({
      code: "LLM_INVALID_OUTPUT",
    });
    expect(await app.subtitles.listCues(episodeId, "pt-BR")).toBeNull();
  });

  it("pede tradução quando ainda não existe", async () => {
    const app = build();
    const playlistId = (await app.ensureDefault({ userId: OWNER, language: "en" })).id;
    const { episodeId } = await app.addSong(songInput(playlistId));
    expect((await app.requestTranslation({ userId: OWNER, isAdmin: false, episodeId, pair })).schedule).toBe(
      true,
    );
  });
});
