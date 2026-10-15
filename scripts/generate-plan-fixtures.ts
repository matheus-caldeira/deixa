import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { AiLessonPlanner } from "@/infrastructure/ai/ai-lesson-planner";
import { alignCues } from "@/modules/alignment";
import { assemblePlan, type PlannerLine } from "@/modules/study";
import { parseSrt, sceneIndexes } from "@/modules/subtitles";
import type { CefrLevel } from "@/shared/levels";
import { SEED_DIALOGUES, SEED_PLAN_LEVELS } from "@/seed/data";

const DIALOGUES_DIR = "fixtures/dialogues";
const PLANS_DIR = "fixtures/plans";
const CONCURRENCY = 2;

async function linesOf(name: string): Promise<PlannerLine[]> {
  const english = parseSrt(await readFile(`${DIALOGUES_DIR}/${name}.en.srt`, "utf8")).cues;
  const portuguese = parseSrt(await readFile(`${DIALOGUES_DIR}/${name}.pt-BR.srt`, "utf8")).cues;
  const withIds = (prefix: string, cues: typeof english) =>
    cues.map((cue) => ({ ...cue, id: `${prefix}${cue.sequence}` }));
  const en = withIds("en", english);
  const pt = withIds("pt", portuguese);
  const byId = new Map(pt.map((cue) => [cue.id, cue.text]));
  const aligned = new Map(alignCues(en, pt).alignments.map((entry) => [entry.enCueId, entry.ptCueIds]));
  return en.map((cue, index) => ({
    index,
    english: cue.text,
    portuguese:
      (aligned.get(cue.id) ?? [])
        .map((id) => byId.get(id) ?? "")
        .join(" ")
        .trim() || null,
  }));
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente no .env");
  const planner = new AiLessonPlanner(
    { provider: "gemini", apiKey, baseUrl: null },
    process.env.GEMINI_MODEL || "gemini-2.5-flash",
    { meter: { ensureAllowed: async () => undefined, record: async () => undefined }, locale: "pt-BR" },
  );
  await mkdir(PLANS_DIR, { recursive: true });
  const jobs = SEED_DIALOGUES.flatMap((name) => SEED_PLAN_LEVELS.map((level) => ({ name, level })));
  const pending = jobs.filter((job) => !existsSync(`${PLANS_DIR}/${job.name}.${job.level}.json`));
  console.info(`planos a gerar: ${pending.length} de ${jobs.length}`);

  async function run(job: { name: string; level: CefrLevel }): Promise<void> {
    const lines = await linesOf(job.name);
    const english = parseSrt(await readFile(`${DIALOGUES_DIR}/${job.name}.en.srt`, "utf8")).cues;
    const scenes = sceneIndexes(english);
    const raw = await planner.plan({ level: job.level, lines });
    const check = assemblePlan({
      raw,
      level: job.level,
      seed: job.name,
      provider: "gemini",
      lines: lines.map((line, index) => ({
        cueId: `c${index}`,
        startMs: english[index]?.startMs ?? 0,
        text: line.english,
        sceneIndex: scenes[index] ?? 0,
        translation: line.portuguese,
      })),
    });
    if (!check) throw new Error(`plano inválido para ${job.name} ${job.level}`);
    await writeFile(`${PLANS_DIR}/${job.name}.${job.level}.json`, `${JSON.stringify(raw, null, 2)}\n`);
    console.info(`ok ${job.name} ${job.level}: ${check.blocks.length - 1} blocos`);
  }

  for (let start = 0; start < pending.length; start += CONCURRENCY) {
    const results = await Promise.allSettled(pending.slice(start, start + CONCURRENCY).map(run));
    for (const result of results)
      if (result.status === "rejected") console.error(`falhou: ${String(result.reason)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "falha ao gerar planos");
  process.exit(1);
});
