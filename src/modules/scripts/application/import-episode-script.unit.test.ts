import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSrt } from "@/modules/subtitles";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import { InMemoryFileStorage } from "@/shared/storage";
import type { StudyLanguage } from "@/shared/study-languages";
import { makeImportEpisodeScript } from "./import-episode-script";
import type { NewScript, ScriptCompletionRow, ScriptRepository, StoredScript } from "./ports";
import { makeGetScriptSummary, makeListScriptCompletions } from "./script-completions";

const EPISODE = "ep-1";
const CUES = parseSrt(readFileSync("fixtures/sample.en.srt", "utf8")).cues.map((cue) => ({
  id: `cue-${cue.sequence}`,
  text: cue.text,
}));

class InMemoryScripts implements ScriptRepository {
  stored: NewScript | null = null;
  replaced = 0;

  async find(episodeId: string, language: StudyLanguage): Promise<StoredScript | null> {
    if (!this.stored || this.stored.episodeId !== episodeId || this.stored.language !== language) return null;
    return this.stored;
  }

  async replace(script: NewScript): Promise<void> {
    this.stored = script;
    this.replaced += 1;
  }

  async listMatchedLines(): Promise<ScriptCompletionRow[]> {
    const byId = new Map(CUES.map((cue) => [cue.id, cue.text]));
    return (this.stored?.lines ?? []).flatMap((line) =>
      line.matchedCueId
        ? [{ cueId: line.matchedCueId, cueText: byId.get(line.matchedCueId) ?? "", lineText: line.text }]
        : [],
    );
  }
}

const upload = (name: string) => ({
  filename: name,
  bytes: new Uint8Array(readFileSync(`fixtures/${name}`)),
});

function setup() {
  const scripts = new InMemoryScripts();
  const storage = new InMemoryFileStorage();
  const importScript = makeImportEpisodeScript({
    scripts,
    storage,
    clock: new FixedClock(new Date("2026-10-15T12:00:00Z")),
    ids: new SequentialIds(),
    findEpisodeLocation: async (episodeId) =>
      episodeId === EPISODE ? { episodeId, mediaId: "media", mediaType: "series", seasonNumber: 1 } : null,
    loadCues: async (episodeId, language) => (episodeId === EPISODE && language === "en" ? CUES : null),
  });
  return {
    scripts,
    storage,
    importScript,
    completions: makeListScriptCompletions({ scripts }),
    summary: makeGetScriptSummary({ scripts }),
  };
}

describe("importação de roteiro", () => {
  it("confere o roteiro, guarda o arquivo e expõe as falas completadas", async () => {
    const t = setup();
    const result = await t.importScript({
      userId: "ana",
      episodeId: EPISODE,
      language: "en",
      upload: upload("sample.en.txt"),
    });
    expect(result).toMatchObject({
      outcome: "PROCESSED",
      status: "VERIFIED",
      matchedCount: 23,
      cueCount: 23,
    });
    expect(result.steps.map((step) => step.key)).toEqual([
      "validateScript",
      "hash",
      "readScript",
      "matchScript",
      "publishScript",
    ]);
    expect(result.steps[3]?.detail).toEqual({
      key: "scriptMatched",
      params: { matched: 23, total: 23, percent: "100%" },
    });
    expect(await t.storage.exists("catalog/series/media/seasons/1/episodes/ep-1/script.en.txt")).toBe(true);
    const completions = await t.completions(EPISODE, "en");
    expect([...completions.keys()]).toEqual(["cue-2", "cue-8"]);
    expect(await t.summary(EPISODE, "en")).toEqual({
      status: "VERIFIED",
      matchedCount: 23,
      cueCount: 23,
      lineCount: 24,
    });
  });

  it("reenvio do mesmo arquivo é duplicidade e não regrava", async () => {
    const t = setup();
    await t.importScript({
      userId: "ana",
      episodeId: EPISODE,
      language: "en",
      upload: upload("sample.en.txt"),
    });
    const again = await t.importScript({
      userId: "lucas",
      episodeId: EPISODE,
      language: "en",
      upload: upload("sample.en.txt"),
    });
    expect(again.outcome).toBe("DUPLICATE");
    expect(again.steps.at(-1)?.detail.key).toBe("scriptIdentical");
    expect(t.scripts.replaced).toBe(1);
  });

  it("só quem enviou o roteiro pode trocá-lo por outro arquivo", async () => {
    const t = setup();
    await t.importScript({
      userId: "ana",
      episodeId: EPISODE,
      language: "en",
      upload: upload("sample.en.txt"),
    });
    const other = {
      filename: "outro.txt",
      bytes: new TextEncoder().encode("SAM: Hey, what are you up to tonight?\n"),
    };
    await expect(
      t.importScript({ userId: "lucas", episodeId: EPISODE, language: "en", upload: other }),
    ).rejects.toMatchObject({ code: "SCRIPT_INVALID", detail: { key: "versionConflict" } });
    expect(t.scripts.replaced).toBe(1);
    const replaced = await t.importScript({
      userId: "ana",
      episodeId: EPISODE,
      language: "en",
      upload: other,
    });
    expect(replaced).toMatchObject({ outcome: "PROCESSED", lineCount: 1, status: "NEEDS_REVIEW" });
    expect(t.scripts.replaced).toBe(2);
  });

  it("recusa arquivo que não é .txt e episódio sem legenda do idioma", async () => {
    const t = setup();
    await expect(
      t.importScript({ userId: "ana", episodeId: EPISODE, language: "en", upload: upload("sample.en.srt") }),
    ).rejects.toMatchObject({ code: "SCRIPT_INVALID", detail: { key: "onlyTxt" } });
    await expect(
      t.importScript({ userId: "ana", episodeId: EPISODE, language: "es", upload: upload("sample.en.txt") }),
    ).rejects.toMatchObject({ code: "SCRIPT_INVALID", detail: { key: "noSubtitle" } });
  });
});
