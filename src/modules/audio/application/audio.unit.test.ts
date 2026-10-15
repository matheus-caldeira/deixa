import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { InMemoryFileStorage } from "@/shared/storage";
import {
  audioHash,
  looksLikeWav,
  normalizeSpeechText,
  silentWav,
  voiceFor,
  type Voice,
} from "../domain/speech";
import { PerUserGate } from "../infrastructure/per-user-gate";
import { SilentTtsProvider } from "../infrastructure/silent-tts-provider";
import { makeGetSpeechAudio, makeListCachedSpeech } from "./get-speech-audio";
import type { AudioAsset, AudioAssetRepository, TtsProvider } from "./ports";

class InMemoryAssets implements AudioAssetRepository {
  readonly rows: AudioAsset[] = [];

  async find(textHash: string, voiceId: string): Promise<AudioAsset | null> {
    return this.rows.find((row) => row.textHash === textHash && row.voiceId === voiceId) ?? null;
  }

  async findExisting(voiceId: string, textHashes: string[]): Promise<Set<string>> {
    return new Set(
      this.rows
        .filter((row) => row.voiceId === voiceId && textHashes.includes(row.textHash))
        .map((row) => row.textHash),
    );
  }

  async save(asset: AudioAsset): Promise<void> {
    if (!(await this.find(asset.textHash, asset.voiceId))) {
      this.rows.push({ textHash: asset.textHash, voiceId: asset.voiceId, storagePath: asset.storagePath });
    }
  }
}

class ScriptedTts implements TtsProvider {
  readonly name = "kokoro" as const;
  readonly modelVersion = "kokoro-test";
  calls: { text: string; voice: Voice }[] = [];
  failing = false;

  voiceFor(requested: Voice): Voice {
    return requested;
  }

  async synthesize(input: { text: string; voice: Voice }): Promise<Uint8Array> {
    this.calls.push(input);
    if (this.failing) throw new Error("serviço fora");
    return silentWav(50);
  }
}

function setup() {
  const assets = new InMemoryAssets();
  const storage = new InMemoryFileStorage();
  const primary = new ScriptedTts();
  const fallback = new SilentTtsProvider();
  const failures: string[] = [];
  const deps = {
    assets,
    storage,
    primary,
    fallback,
    gate: new PerUserGate(2),
    clock: new FixedClock("2026-10-10T12:00:00Z"),
    ids: new SequentialIds("a"),
    onPrimaryFailure: (reason: string) => failures.push(reason),
  };
  return {
    assets,
    storage,
    primary,
    fallback,
    failures,
    getAudio: makeGetSpeechAudio(deps),
    listCached: makeListCachedSpeech(deps),
  };
}

const US = voiceFor("en", "US");
const UK = voiceFor("en", "UK");

describe("hash e formato do áudio", () => {
  it("é estável para o mesmo texto normalizado e muda com voz, idioma ou versão do modelo", () => {
    const base = { text: "What are you up to?", voiceId: "af_heart", language: "en-us", modelVersion: "v1" };
    expect(audioHash(base)).toBe(audioHash({ ...base, text: "  what  ARE you up to?  " }));
    expect(audioHash(base)).not.toBe(audioHash({ ...base, voiceId: "bf_emma" }));
    expect(audioHash(base)).not.toBe(audioHash({ ...base, language: "en-gb" }));
    expect(audioHash(base)).not.toBe(audioHash({ ...base, modelVersion: "v2" }));
    expect(audioHash(base)).not.toBe(audioHash({ ...base, text: "What are you up to tonight?" }));
    expect(normalizeSpeechText("Don’t  go")).toBe("Don't go");
  });

  it("gera um WAV curto de silêncio válido", () => {
    const wav = silentWav(300);
    expect(looksLikeWav(wav)).toBe(true);
    expect(wav.length).toBe(44 + 2400 * 2);
    expect(looksLikeWav(new Uint8Array([1, 2, 3]))).toBe(false);
  });
});

describe("áudio sob demanda com cache", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("gera no primeiro pedido, salva em data/audio/{voz}/{hash}.wav e serve do cache no segundo", async () => {
    const first = await app.getAudio({
      userId: "ana",
      text: "Hey, what are you up to tonight?",
      voice: US,
    });
    expect(first).toMatchObject({ cache: "miss", provider: "kokoro" });
    const [path] = [...app.storage.files.keys()];
    expect(path).toMatch(/^audio\/af_heart\/[0-9a-f]{64}\.wav$/);

    const second = await app.getAudio({
      userId: "lucas",
      text: "Hey, what are you up to tonight?",
      voice: US,
    });
    expect(second).toMatchObject({ cache: "hit", provider: "kokoro" });
    expect(app.primary.calls).toHaveLength(1);
    expect(app.assets.rows).toHaveLength(1);
  });

  it("usa a voz do sotaque do usuário e guarda um áudio por voz", async () => {
    await app.getAudio({ userId: "ana", text: "Fair enough.", voice: US });
    await app.getAudio({ userId: "lucas", text: "Fair enough.", voice: UK });
    expect(app.primary.calls.map((call) => call.voice)).toEqual([
      { voiceId: "af_heart", language: "en-us" },
      { voiceId: "bf_emma", language: "en-gb" },
    ]);
    expect(app.assets.rows.map((row) => row.voiceId)).toEqual(["af_heart", "bf_emma"]);
  });

  it("regenera quando o arquivo do cache sumiu ou está corrompido", async () => {
    await app.getAudio({ userId: "ana", text: "No way.", voice: US });
    const [path] = [...app.storage.files.keys()];
    app.storage.files.set(path ?? "", new Uint8Array([0, 1, 2]));
    const again = await app.getAudio({ userId: "ana", text: "No way.", voice: US });
    expect(again.cache).toBe("miss");
    expect(app.primary.calls).toHaveLength(2);
    expect(app.assets.rows).toHaveLength(1);
  });

  it("cai para o silêncio quando o Kokoro falha, sem ocupar o cache da voz real", async () => {
    app.primary.failing = true;
    const first = await app.getAudio({ userId: "ana", text: "Deal.", voice: US });
    expect(first).toMatchObject({ cache: "miss", provider: "silent" });
    expect(app.failures).toEqual(["serviço fora"]);
    expect([...app.storage.files.keys()].every((path) => path.startsWith("audio/silent/"))).toBe(true);

    const second = await app.getAudio({ userId: "ana", text: "Deal.", voice: US });
    expect(second).toMatchObject({ cache: "hit", provider: "silent" });
    expect(app.fallback.calls).toBe(1);

    app.primary.failing = false;
    const recovered = await app.getAudio({ userId: "ana", text: "Deal.", voice: US });
    expect(recovered).toMatchObject({ cache: "miss", provider: "kokoro" });
  });

  it("limita gerações simultâneas por usuário sem afetar os outros", async () => {
    const gate = new PerUserGate(2);
    expect(gate.tryEnter("ana")).toBe(true);
    expect(gate.tryEnter("ana")).toBe(true);
    expect(gate.tryEnter("ana")).toBe(false);
    expect(gate.tryEnter("lucas")).toBe(true);
    gate.leave("ana");
    expect(gate.tryEnter("ana")).toBe(true);
  });

  it("informa quais falas já têm áudio para a voz do usuário e recusa texto vazio", async () => {
    await app.getAudio({ userId: "ana", text: "Deal.", voice: US });
    const lines = [
      { id: "c1", text: "Deal." },
      { id: "c2", text: "Promise?" },
    ];
    expect(await app.listCached({ voice: US, lines })).toEqual(["c1"]);
    expect(await app.listCached({ voice: UK, lines })).toEqual([]);
    await expect(app.getAudio({ userId: "ana", text: "   ", voice: US })).rejects.toMatchObject({
      code: "AUDIO_UNAVAILABLE",
    });
  });
});
