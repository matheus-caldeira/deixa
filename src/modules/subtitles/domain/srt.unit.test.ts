import { describe, expect, it } from "vitest";
import {
  MAX_CUES_PER_SUBTITLE,
  MAX_CUE_TEXT_LENGTH,
  MAX_SUBTITLE_BYTES,
  decodeSubtitle,
  parseSrt,
  sceneIndexes,
  validateSubtitleFile,
} from "./srt";

describe("parser SRT", () => {
  it("lê blocos simples com índice, tempo e texto", () => {
    const { cues, skippedBlocks } = parseSrt(
      "1\n00:01:05,220 --> 00:01:06,870\nHey, what are you up to tonight?\n\n2\n00:01:07,000 --> 00:01:10,500\nNothing much.\n",
    );
    expect(cues).toEqual([
      { sequence: 1, startMs: 65_220, endMs: 66_870, text: "Hey, what are you up to tonight?" },
      { sequence: 2, startMs: 67_000, endMs: 70_500, text: "Nothing much." },
    ]);
    expect(skippedBlocks).toBe(0);
  });

  it("junta falas de várias linhas e remove marcas de formatação sem tocar em contrações", () => {
    const { cues } = parseSrt("7\n00:00:01,000 --> 00:00:03,000\n<i>Don't beat</i>\n{\\an8}yourself up.\n");
    expect(cues[0]?.text).toBe("Don't beat yourself up.");
  });

  it("aceita BOM, CRLF, ponto como separador de milissegundos e bloco sem índice", () => {
    const { cues } = parseSrt(
      "﻿1\r\n00:00:01.5 --> 00:00:02.250\r\nOi\r\n\r\n00:00:03,000 --> 00:00:04,000\r\nTchau\r\n",
    );
    expect(cues.map((cue) => [cue.sequence, cue.startMs, cue.endMs, cue.text])).toEqual([
      [1, 1500, 2250, "Oi"],
      [2, 3000, 4000, "Tchau"],
    ]);
  });

  it("ignora bloco sem tempo, sem texto ou com fim antes do início e renumera a sequência", () => {
    const { cues, skippedBlocks } = parseSrt(
      "bloco solto\n\n1\n00:00:05,000 --> 00:00:04,000\nInvertido\n\n2\n00:00:06,000 --> 00:00:07,000\n\n\n3\n00:00:08,000 --> 00:00:09,000\nVálido\n",
    );
    expect(cues).toEqual([{ sequence: 1, startMs: 8000, endMs: 9000, text: "Válido" }]);
    expect(skippedBlocks).toBe(3);
  });
});

describe("limites contra arquivo malicioso", () => {
  it("processa em tempo linear uma fala cheia de marcas abertas e corta texto longo demais", () => {
    const hostile = "<a".repeat(200_000);
    const started = performance.now();
    const { cues } = parseSrt(`1\n00:00:01,000 --> 00:00:02,000\n${hostile}\n`);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(cues[0]?.text.length).toBe(MAX_CUE_TEXT_LENGTH);
  });

  it("recusa legenda com mais falas do que um episódio comporta", () => {
    const block = (index: number) => `${index}\n00:00:01,000 --> 00:00:02,000\nx\n`;
    const tooMany = Array.from({ length: MAX_CUES_PER_SUBTITLE + 1 }, (_, index) => block(index + 1)).join(
      "\n",
    );
    expect(() => parseSrt(tooMany)).toThrow(/tooManyCues/);
  });
});

describe("decodificação e validação do arquivo", () => {
  it("decodifica UTF-8 e cai para Windows-1252 quando o arquivo não é UTF-8", () => {
    expect(decodeSubtitle(new TextEncoder().encode("Olá, você"))).toBe("Olá, você");
    expect(decodeSubtitle(new Uint8Array([0x4f, 0x6c, 0xe1]))).toBe("Olá");
  });

  it("recusa extensão errada, arquivo vazio e arquivo grande demais", () => {
    const bytes = new TextEncoder().encode("x");
    expect(() => validateSubtitleFile({ filename: "legenda.txt", bytes })).toThrow(/onlySrt/);
    expect(() => validateSubtitleFile({ filename: "legenda.srt", bytes: new Uint8Array() })).toThrow(
      /emptyFile/,
    );
    expect(() =>
      validateSubtitleFile({ filename: "a.SRT", bytes: new Uint8Array(MAX_SUBTITLE_BYTES + 1) }),
    ).toThrow(/tooLarge/);
    expect(() => validateSubtitleFile({ filename: "a.SRT", bytes })).not.toThrow();
  });
});

describe("divisão em cenas", () => {
  it("abre uma cena nova depois de um silêncio longo", () => {
    const cues = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 2500, endMs: 4000 },
      { startMs: 40_000, endMs: 42_000 },
      { startMs: 43_000, endMs: 44_000 },
      { startMs: 90_000, endMs: 91_000 },
    ];
    expect(sceneIndexes(cues)).toEqual([0, 0, 1, 1, 2]);
  });
});
