import { describe, expect, it } from "vitest";
import { cuesToSrt, formatSrtTime, hasTimestamps, lrcToCues, parseLrc } from "./lrc";
import { parseSrt } from "@/modules/subtitles";

const SAMPLE = `[ar:Banda Fictícia]
[ti:Canção de Teste]
[al:Álbum]
[offset:0]
[00:01.50]First line
[00:05.00]Second line
[00:09.20]
[00:12.00]Third line
`;

describe("parseLrc", () => {
  it("lê metadados e linhas em ordem", () => {
    const parsed = parseLrc(SAMPLE);
    expect(parsed.metadata).toEqual({ artist: "Banda Fictícia", title: "Canção de Teste", album: "Álbum" });
    expect(parsed.lines.map((line) => line.timeMs)).toEqual([1500, 5000, 9200, 12000]);
    expect(parsed.lines[2]?.text).toBe("");
  });

  it("expande linhas com vários timestamps", () => {
    const parsed = parseLrc("[00:20.00][00:10.00]Refrão\n[00:15.00]Verso");
    expect(parsed.lines).toEqual([
      { timeMs: 10000, text: "Refrão" },
      { timeMs: 15000, text: "Verso" },
      { timeMs: 20000, text: "Refrão" },
    ]);
  });

  it("aceita frações de 1, 2 e 3 dígitos e dois pontos", () => {
    const parsed = parseLrc("[00:01.5]a\n[00:02.25]b\n[00:03.125]c\n[00:04:50]d\n[01:00]e");
    expect(parsed.lines.map((line) => line.timeMs)).toEqual([1500, 2250, 3125, 4500, 60000]);
  });

  it("aplica offset e remove marcas de palavra", () => {
    const parsed = parseLrc("[offset:500]\n[00:02.00]<00:02.00>Hello <00:02.50>world");
    expect(parsed.lines).toEqual([{ timeMs: 1500, text: "Hello world" }]);
  });

  it("ignora texto sem timestamp e arquivo vazio", () => {
    expect(parseLrc("sem tempo\n\n").lines).toEqual([]);
    expect(hasTimestamps("sem tempo")).toBe(false);
    expect(hasTimestamps("[00:01.00]x")).toBe(true);
  });
});

describe("lrcToCues", () => {
  it("encerra cada fala no início da próxima e trata linha vazia como intervalo", () => {
    const cues = lrcToCues(parseLrc(SAMPLE).lines);
    expect(cues).toEqual([
      { sequence: 1, startMs: 1500, endMs: 5000, text: "First line" },
      { sequence: 2, startMs: 5000, endMs: 9200, text: "Second line" },
      { sequence: 3, startMs: 12000, endMs: 16000, text: "Third line" },
    ]);
  });

  it("limita a fala a 7 segundos", () => {
    const cues = lrcToCues(parseLrc("[00:00.00]Long\n[01:00.00]Next").lines);
    expect(cues[0]?.endMs).toBe(7000);
  });

  it("usa a duração da faixa na última fala", () => {
    const cues = lrcToCues(parseLrc("[00:10.00]Last").lines, { durationMs: 11500 });
    expect(cues[0]?.endMs).toBe(11500);
  });

  it("gera SRT que o parser do projeto lê de volta", () => {
    const cues = lrcToCues(parseLrc(SAMPLE).lines);
    const srt = cuesToSrt(cues);
    const back = parseSrt(srt).cues;
    expect(back.map((cue) => [cue.startMs, cue.endMs, cue.text])).toEqual(
      cues.map((cue) => [cue.startMs, cue.endMs, cue.text]),
    );
    expect(cuesToSrt(cues)).toBe(srt);
  });

  it("formata tempo do SRT", () => {
    expect(formatSrtTime(3_723_456)).toBe("01:02:03,456");
  });
});
