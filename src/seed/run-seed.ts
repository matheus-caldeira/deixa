import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import type { Container } from "@/infrastructure/container";
import type { Database } from "@/infrastructure/database/client";
import {
  learningItemExplanations,
  lessonAttempts,
  mediaItems,
  learningItems,
  userCards,
  userPreferences,
  users,
} from "@/infrastructure/database/schema";
import {
  makeLoadSeasonEpisodes,
  makeRegisterWork,
  type CatalogRepository,
  type EpisodeProgressRepository,
  type MetadataProvider,
} from "@/modules/catalog";
import { fakeExternalId } from "@/modules/catalog/infrastructure/fake-metadata-provider";
import type { CueMarks } from "@/modules/highlights";
import { defaultPreferences } from "@/modules/identity";
import { assemblePlan } from "@/modules/study";
import { scryptPasswords } from "@/modules/identity/infrastructure/crypto";
import { systemClock } from "@/shared/clock";
import { isAppError } from "@/shared/errors";
import { uuidGenerator } from "@/shared/ids";
import { normalizeTerm, tokenize } from "@/shared/text";
import { MS_PER_DAY } from "@/shared/time";
import {
  SEED_DIALOGUES,
  SEED_EMAIL_SUFFIX,
  SEED_ADMIN_SLUG,
  SEED_PASSWORD,
  SEED_PLAN_LEVELS,
  SEED_PROFILES,
  SEED_WORKS,
  SHARED_MARKS,
  type EpisodeKey,
} from "./data";

const SEED_HISTORY_DAYS = 60;
const DIALOGUES_DIR = "fixtures/dialogues";
const PLANS_DIR = "fixtures/plans";

export async function runSeed(input: {
  container: Container;
  db: Database;
  catalog: CatalogRepository & EpisodeProgressRepository;
  metadata: MetadataProvider;
  log: (message: string) => void;
}): Promise<void> {
  const { container, db, catalog, metadata, log } = input;
  const clock = systemClock;
  const ids = uuidGenerator;
  const now = clock.now();

  const userIdBySlug = new Map<string, string>();
  for (const profile of SEED_PROFILES) {
    const email = `${profile.slug}${SEED_EMAIL_SUFFIX}`;
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    const id = existing?.id ?? ids.next();
    if (!existing) {
      await db.insert(users).values({
        id,
        name: profile.name,
        email,
        passwordHash: await scryptPasswords.hash(SEED_PASSWORD),
        avatarColor: profile.color,
        createdAt: new Date(now.getTime() + userIdBySlug.size),
      });
      await db.insert(userPreferences).values({
        userId: id,
        ...defaultPreferences(profile.level),
        dailyGoal: profile.dailyGoal,
        preferredAccent: profile.accent,
        audioSpeed: profile.audioSpeed,
      });
    }
    userIdBySlug.set(profile.slug, id);
  }
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true)).limit(1);
  const ownerId = userIdBySlug.get(SEED_ADMIN_SLUG);
  if (!admin && ownerId) await db.update(users).set({ isAdmin: true }).where(eq(users.id, ownerId));
  log(`perfis: ${[...userIdBySlug.keys()].join(", ")}`);

  const catalogDeps = { catalog, metadata, clock, ids };

  async function externalIdOf(work: (typeof SEED_WORKS)[number]): Promise<string | null> {
    if (metadata.name === "fake") return fakeExternalId(work.slug);
    const found = await metadata.searchWorks(work.title);
    const sameType = found.filter((candidate) => candidate.type === work.type);
    const exact =
      sameType.find((candidate) => candidate.originalTitle === work.title && candidate.year === work.year) ??
      sameType.find((candidate) => candidate.year === work.year) ??
      sameType[0];
    return exact?.externalId ?? null;
  }
  const registerWork = makeRegisterWork(catalogDeps);
  const loadSeasonEpisodes = makeLoadSeasonEpisodes(catalogDeps);
  const dialogues = await Promise.all(
    SEED_DIALOGUES.map(async (name) => ({
      name,
      english: {
        filename: `${name}.en.srt`,
        bytes: new Uint8Array(await readFile(`${DIALOGUES_DIR}/${name}.en.srt`)),
      },
      portuguese: {
        filename: `${name}.pt-BR.srt`,
        bytes: new Uint8Array(await readFile(`${DIALOGUES_DIR}/${name}.pt-BR.srt`)),
      },
    })),
  );
  let importedEpisodes = 0;
  let seededPlans = 0;

  async function seedPlans(episodeId: string, dialogueName: string): Promise<void> {
    const script = await container.getEpisodeScript(episodeId);
    if (!script) return;
    const lines = script.lines.map((line) => ({
      cueId: line.cueId,
      startMs: line.startMs,
      text: line.text,
      sceneIndex: line.sceneIndex,
      translation: line.translationSource === "subtitle_pt" ? line.translation : null,
    }));
    for (const level of SEED_PLAN_LEVELS) {
      const path = `${PLANS_DIR}/${dialogueName}.${level}.json`;
      if (!existsSync(path)) continue;
      const plan = assemblePlan({
        raw: JSON.parse(await readFile(path, "utf8")),
        lines,
        level,
        seed: episodeId,
        provider: "gemini",
      });
      if (!plan) continue;
      await container.savePlan({ id: ids.next(), episodeId, level, plan, now });
      seededPlans += 1;
    }
  }

  const episodeIdByKey = new Map<EpisodeKey, string>();
  for (const work of SEED_WORKS) {
    const uploaderId = userIdBySlug.get(work.uploader) ?? null;
    const externalId = await externalIdOf(work);
    if (!externalId) {
      log(`obra não encontrada no provider: ${work.title}`);
      continue;
    }
    const { mediaId } = await registerWork({ userId: uploaderId, type: work.type, externalId });
    await db
      .update(mediaItems)
      .set({ levelMin: work.levels[0], levelMax: work.levels[1], accent: work.accent })
      .where(eq(mediaItems.id, mediaId));
    const wantedSeasons = new Set(Object.keys(work.episodes).map((key) => Number(key.split("-")[1])));
    for (const season of await catalog.listSeasons(mediaId)) {
      if (!wantedSeasons.has(season.seasonNumber)) continue;
      const loaded = await loadSeasonEpisodes({ mediaId, seasonNumber: season.seasonNumber });
      for (const episode of loaded.episodes) {
        episodeIdByKey.set(`${work.slug}-${season.seasonNumber}-${episode.episodeNumber}`, episode.id);
      }
    }
    for (const [key, state] of Object.entries(work.episodes) as [EpisodeKey, string][]) {
      const episodeId = episodeIdByKey.get(key);
      if (!episodeId || !uploaderId) continue;
      const dialogue = dialogues[importedEpisodes % dialogues.length];
      importedEpisodes += 1;
      if (!dialogue) continue;
      const alreadyImported = (await container.getEpisodeScript(episodeId)) !== null;
      if (alreadyImported) {
        await seedPlans(episodeId, dialogue.name);
        continue;
      }
      await container.importEpisodeSubtitles({
        userId: uploaderId,
        episodeId,
        english: dialogue.english,
        portuguese: state === "READY_PT" ? dialogue.portuguese : undefined,
      });
      await seedPlans(episodeId, dialogue.name);
    }
  }
  log(
    `obras: ${SEED_WORKS.length} via ${metadata.name}, episódios cadastrados: ${episodeIdByKey.size}, trilhas prontas: ${seededPlans}`,
  );

  async function marksFor(
    episodeId: string,
    ranges: [number, number, number][],
    lines: number[],
  ): Promise<CueMarks[]> {
    const script = await container.getEpisodeScript(episodeId);
    if (!script) return [];
    const byCue = new Map<string, CueMarks>();
    const entry = (lineIndex: number): CueMarks | null => {
      const line = script.lines[lineIndex];
      if (!line) return null;
      const existing = byCue.get(line.cueId) ?? { cueId: line.cueId, tokens: [], wholeLine: false };
      byCue.set(line.cueId, existing);
      return existing;
    };
    for (const [lineIndex, startToken, endToken] of ranges) {
      const mark = entry(lineIndex);
      if (!mark) continue;
      for (let token = startToken; token <= endToken; token += 1) mark.tokens.push(token);
    }
    for (const lineIndex of lines) {
      const mark = entry(lineIndex);
      if (mark) mark.wholeLine = true;
    }
    return [...byCue.values()];
  }

  async function seedXpHistory(userId: string, profile: (typeof SEED_PROFILES)[number]): Promise<void> {
    const goal = profile.dailyGoal;
    const metToday = profile.history.xpToday >= goal;
    const streakDaysBeforeToday = metToday ? profile.history.streak - 1 : profile.history.streak;
    let seeded = 0;
    const award = async (daysAgo: number, amount: number) => {
      if (amount <= 0) return;
      seeded += amount;
      await container.awardXp({
        userId,
        source: "seed",
        sourceId: `day-${daysAgo}`,
        amount,
        at: new Date(now.getTime() - daysAgo * MS_PER_DAY),
      });
    };
    await award(0, profile.history.xpToday);
    for (let daysAgo = 1; daysAgo < SEED_HISTORY_DAYS; daysAgo += 1) {
      const variation = ((daysAgo * 37) % 5) * Math.round(goal / 10);
      if (daysAgo <= streakDaysBeforeToday) await award(daysAgo, goal + variation);
      else if (daysAgo === streakDaysBeforeToday + 1) await award(daysAgo, 0);
      else
        await award(
          daysAgo,
          daysAgo % 3 === 0 ? 0 : daysAgo % 3 === 1 ? Math.round(goal / 2) : goal + variation,
        );
    }
    await container.awardXp({
      userId,
      source: "seed",
      sourceId: "historico",
      amount: Math.max(0, profile.history.totalXp - seeded),
      at: new Date(now.getTime() - (SEED_HISTORY_DAYS + 30) * MS_PER_DAY),
    });
  }

  for (const shared of SHARED_MARKS) {
    const episodeId = episodeIdByKey.get(shared.episode);
    if (!episodeId) continue;
    for (const slug of shared.by) {
      const profile = SEED_PROFILES.find((candidate) => candidate.slug === slug);
      const userId = userIdBySlug.get(slug);
      if (!profile || !userId) continue;
      const current = await container.getReadingView(userId, episodeId);
      const alreadyCarded = current.highlights.some((highlight) => highlight.cardBatchId !== null);
      if (alreadyCarded && shared.by.length > 1) continue;
      const known = current.highlights.map((highlight) => highlight.cueId);
      const marks = await marksFor(episodeId, shared.marks, shared.lines);
      const merged = [
        ...marks,
        ...current.highlights
          .filter((highlight) => !marks.some((mark) => mark.cueId === highlight.cueId))
          .map((highlight) => ({
            cueId: highlight.cueId,
            tokens:
              highlight.kind === "line"
                ? []
                : Array.from(
                    { length: highlight.endToken - highlight.startToken + 1 },
                    (_, offset) => highlight.startToken + offset,
                  ),
            wholeLine: highlight.kind === "line",
          })),
      ];
      if (known.length > 0 && marks.every((mark) => known.includes(mark.cueId))) continue;
      await container.syncHighlights({ userId, episodeId, marks: merged });
      try {
        const batch = await container.generateCardDrafts({ userId, episodeId, learnerLevel: profile.level });
        await container.confirmCardBatch({
          userId,
          batchId: batch.batchId,
          keepKeys: batch.drafts.map((draft) => draft.key),
          scope: "catalog",
        });
      } catch (error) {
        if (!isAppError(error) || error.code !== "NO_HIGHLIGHTS") throw error;
      }
    }
  }

  for (const profile of SEED_PROFILES) {
    const userId = userIdBySlug.get(profile.slug);
    if (!userId) continue;
    await container.saveSnapshot(userId, profile.snapshot);
    await seedXpHistory(userId, profile);
    for (const [key, percent] of Object.entries(profile.progress) as [EpisodeKey, number][]) {
      const episodeId = episodeIdByKey.get(key);
      if (episodeId) await catalog.upsert(userId, episodeId, percent, now);
    }
    const currentEpisodeId = episodeIdByKey.get(profile.currentEpisode);
    if (currentEpisodeId) {
      await container.updatePreferences(userId, { currentEpisodeId });
      await container.ensurePlan({
        userId,
        episodeId: currentEpisodeId,
        level: profile.level,
        episodeLabel: "",
        retry: true,
      });
      const trail = await container.getTrail(userId, currentEpisodeId, profile.level);
      const alreadyStudied = trail.nodes.some((node) => node.state === "done");
      for (let nodeIndex = 0; !alreadyStudied && nodeIndex < profile.scenesDone; nodeIndex += 1) {
        await db.insert(lessonAttempts).values({
          id: ids.next(),
          userId,
          episodeId: currentEpisodeId,
          nodeIndex,
          level: profile.level,
          correct: 5,
          total: 6,
          xp: 0,
          seconds: 180,
          replay: false,
          passed: true,
          createdAt: new Date(now.getTime() - (profile.scenesDone - nodeIndex) * 3_600_000),
        });
      }
      const view = await container.getReadingView(userId, currentEpisodeId);
      if (view.highlights.length === 0) {
        await container.syncHighlights({
          userId,
          episodeId: currentEpisodeId,
          marks: await marksFor(currentEpisodeId, profile.premarks, profile.prelines),
        });
      }
    }

    const [curated] = await db
      .select({ id: userCards.id })
      .from(userCards)
      .where(eq(userCards.userId, userId))
      .limit(1);
    const hasCurated =
      Boolean(curated) &&
      (await container.listDueCards(userId)).cards.some((card) => card.sourceKind === "curated");
    if (hasCurated) continue;
    const created: { learningItemId: string; sourceKind: string }[] = [];
    for (const [index, review] of profile.reviews.entries()) {
      const itemId = ids.next();
      await db.insert(learningItems).values({
        id: itemId,
        episodeId: episodeIdByKey.get(review.episode) ?? null,
        sourceText: review.en,
        normalizedText: normalizeTerm(review.en),
        difficulty: profile.level,
        itemType: tokenize(review.en).length > 3 ? "sentence" : "expression",
        origin: "curated",
        visibility: "private",
        ownerUserId: userId,
        status: "ACTIVE",
        createdAt: new Date(now.getTime() - (profile.reviews.length - index) * 1000),
      });
      await db.insert(learningItemExplanations).values({
        learningItemId: itemId,
        locale: "pt-BR",
        translation: review.pt,
        translationSource: "subtitle_pt",
      });
      created.push({ learningItemId: itemId, sourceKind: "curated" });
    }
    await container.addCards(userId, created);
  }
  log("progresso, retratos, marcações e revisões de demonstração prontos");
}
