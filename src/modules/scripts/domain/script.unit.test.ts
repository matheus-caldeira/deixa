import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSrt } from "@/modules/subtitles";
import { completesCue, matchScriptToCues, parseScriptText, scriptTokens } from "./script";

const SCRIPT = readFileSync("fixtures/sample.en.txt", "utf8");
const CUES = parseSrt(readFileSync("fixtures/sample.en.srt", "utf8")).cues.map((cue) => ({
  id: `cue-${cue.sequence}`,
  text: cue.text,
}));

describe("leitura do roteiro", () => {
  it("remove nomes de personagem, rubricas e cabeçalhos de cena", () => {
    const lines = parseScriptText(
      [
        "INT. BAR - NIGHT",
        "",
        "SAM: Hey, what are you up to tonight?",
        "[Alex looks across the bar]",
        "Alex: Nothing much (yawning). I was gonna stay in.",
        "♪ background music ♪",
        "   ",
        "Just play it cool.",
      ].join("\n"),
    );
    expect(lines).toEqual([
      "Hey, what are you up to tonight?",
      "Nothing much . I was gonna stay in.",
      "Just play it cool.",
    ]);
  });

  it("tokeniza ignorando pontuação e caixa, preservando contrações", () => {
    expect(scriptTokens("Don't beat yourself up. It happens!")).toEqual([
      "don't",
      "beat",
      "yourself",
      "up",
      "it",
      "happens",
    ]);
  });
});

describe("conferência do roteiro contra a legenda", () => {
  it("casa as falas em ordem e marca o roteiro como conferido", () => {
    const match = matchScriptToCues(parseScriptText(SCRIPT), CUES);
    expect(match.matchedCues).toBe(23);
    expect(match.status).toBe("VERIFIED");
    expect(match.lines.filter((line) => line.verified)).toHaveLength(23);
    expect(match.lines[0]).toMatchObject({ sequence: 1, matchedCueId: null, verified: false });
    expect(match.lines[1]).toMatchObject({
      sequence: 2,
      text: "Hey, what are you up to tonight?",
      matchedCueId: "cue-1",
    });
    const longer = match.lines.find((line) => line.matchedCueId === "cue-8");
    expect(longer?.text).toBe(
      "She spent the whole night on her phone, scrolling and laughing at something else.",
    );
  });

  it("só anda para a frente: uma fala repetida mais tarde não volta para uma linha anterior", () => {
    const lines = [
      "Promise?",
      "I promise. Now can we please call it a night?",
      "Deal. First round's on me.",
      "Promise?",
    ];
    const cues = [
      { id: "a", text: "Deal. First round's on me." },
      { id: "b", text: "Promise?" },
    ];
    const match = matchScriptToCues(lines, cues);
    expect(match.lines.map((line) => line.matchedCueId)).toEqual([null, null, "a", "b"]);
  });

  it("recusa uma fala curta que só bate parcialmente e fica em revisão quando pouco bate", () => {
    const match = matchScriptToCues(
      ["Hey there, stranger, what brings you here?"],
      [
        { id: "a", text: "Hey" },
        { id: "b", text: "Totally unrelated sentence about cats." },
      ],
    );
    expect(match.matchedCues).toBe(0);
    expect(match.status).toBe("NEEDS_REVIEW");
  });

  it("aponta quando a linha do roteiro completa uma fala cortada", () => {
    expect(
      completesCue(
        "She spent the whole night on her phone.",
        "She spent the whole night on her phone, scrolling and laughing.",
      ),
    ).toBe(true);
    expect(completesCue("Deal. First round's on me.", "Deal. First round's on me.")).toBe(false);
  });
});
