import { beforeEach, describe, expect, it } from "vitest";
import { FixedClock } from "@/shared/clock";
import { SequentialIds } from "@/shared/ids";
import type { CefrLevel } from "@/shared/levels";
import type { LanguagePair, StudyLanguage } from "@/shared/study-languages";
import { correctAnswerText, type Answer, type Exercise } from "@/modules/study";
import type { Episode, EpisodeCard, Season, Series, SeriesLevel } from "../domain/series";
import type { DescribeSeriesInput, EpisodeSource, OwnedEpisode, PersonalSeriesRepository } from "./ports";
import {
  makeGetEpisodeTrail,
  makeGetPersonalSeries,
  makeGetSeasonContext,
  makePlaceCards,
  makeRefreshSeriesDescription,
  makeRenameSeries,
  makeSetSeriesLevel,
} from "./series-use-cases";
import { makeCompletePersonalLesson, makeStartPersonalLesson } from "./lesson-use-cases";

type StoredEpisode = Omit<Episode, "cardCount" | "sourceCount"> & { seriesId: string; completed: number[] };
type StoredCard = { seriesId: string; episodeId: string; learningItemId: string; sessionId: string | null };

class InMemorySeries implements PersonalSeriesRepository {
  readonly series: Series[] = [];
  readonly seasons: (Season & { seriesId: string })[] = [];
  readonly episodes: StoredEpisode[] = [];
  readonly cards: StoredCard[] = [];
  readonly terms = new Map<string, { term: string; translation: string }>();

  async findSeries(userId: string, pair: LanguagePair) {
    return (
      this.series.find(
        (series) =>
          series.userId === userId &&
          series.pair.target === pair.target &&
          series.pair.native === pair.native,
      ) ?? null
    );
  }

  async ensureSeries(input: {
    id: string;
    userId: string;
    pair: LanguagePair;
    startLevel: CefrLevel;
    now: Date;
  }) {
    const known = await this.findSeries(input.userId, input.pair);
    if (known) return known;
    const created: Series = {
      id: input.id,
      userId: input.userId,
      pair: input.pair,
      name: null,
      description: null,
      descriptionUpdatedAt: null,
      descriptionBasis: null,
      level: { mode: "auto", min: null, max: null },
      startLevel: input.startLevel,
      createdAt: input.now,
    };
    this.series.push(created);
    return created;
  }

  async listSeasons(seriesId: string) {
    return this.seasons
      .filter((season) => season.seriesId === seriesId)
      .map(({ seriesId: _seriesId, ...season }) => season);
  }

  async ensureSeason(input: { id: string; seriesId: string; level: CefrLevel }) {
    const known = this.seasons.find(
      (season) => season.seriesId === input.seriesId && season.level === input.level,
    );
    if (known) return { id: known.id, number: known.number, level: known.level };
    const season = {
      id: input.id,
      seriesId: input.seriesId,
      level: input.level,
      number: this.seasons.filter((candidate) => candidate.seriesId === input.seriesId).length + 1,
    };
    this.seasons.push(season);
    return { id: season.id, number: season.number, level: season.level };
  }

  private counted(episode: StoredEpisode): Episode {
    const cards = this.cards.filter((card) => card.episodeId === episode.id);
    const { seriesId: _seriesId, completed: _completed, ...rest } = episode;
    return {
      ...rest,
      cardCount: cards.length,
      sourceCount: new Set(cards.flatMap((card) => (card.sessionId ? [card.sessionId] : []))).size,
    };
  }

  async listEpisodes(seriesId: string) {
    return this.episodes
      .filter((episode) => episode.seriesId === seriesId)
      .map((episode) => this.counted(episode));
  }

  async createEpisode(input: {
    id: string;
    seriesId: string;
    seasonId: string;
    theme: string;
    part: number;
    title: string;
    now: Date;
  }) {
    const known = this.episodes.find(
      (episode) =>
        episode.seasonId === input.seasonId && episode.theme === input.theme && episode.part === input.part,
    );
    if (known) return { id: known.id, created: false };
    this.episodes.push({
      id: input.id,
      seriesId: input.seriesId,
      seasonId: input.seasonId,
      number: this.episodes.filter((episode) => episode.seasonId === input.seasonId).length + 1,
      title: input.title,
      theme: input.theme,
      part: input.part,
      createdAt: input.now,
      completed: [],
    });
    return { id: input.id, created: true };
  }

  async addCards(input: {
    seriesId: string;
    episodeId: string;
    cards: { learningItemId: string; sessionId: string | null }[];
  }) {
    let added = 0;
    for (const card of input.cards) {
      if (
        this.cards.some(
          (known) => known.seriesId === input.seriesId && known.learningItemId === card.learningItemId,
        )
      )
        continue;
      this.cards.push({ seriesId: input.seriesId, episodeId: input.episodeId, ...card });
      added += 1;
    }
    return added;
  }

  async findEpisode(userId: string, episodeId: string): Promise<OwnedEpisode | null> {
    const episode = this.episodes.find((candidate) => candidate.id === episodeId);
    const series = this.series.find((candidate) => candidate.id === episode?.seriesId);
    const season = this.seasons.find((candidate) => candidate.id === episode?.seasonId);
    if (!episode || !series || series.userId !== userId || !season) return null;
    return {
      ...this.counted(episode),
      seriesId: episode.seriesId,
      season: { id: season.id, number: season.number, level: season.level },
      completedNodes: episode.completed,
    };
  }

  private toCard(card: StoredCard): EpisodeCard {
    const known = this.terms.get(card.learningItemId);
    return {
      learningItemId: card.learningItemId,
      term: known?.term ?? card.learningItemId,
      translation: known?.translation ?? null,
    };
  }

  async listEpisodeCards(episodeId: string, _native: StudyLanguage) {
    return this.cards.filter((card) => card.episodeId === episodeId).map((card) => this.toCard(card));
  }

  async listSeriesCards(seriesId: string, _native: StudyLanguage, limit: number) {
    return this.cards
      .filter((card) => card.seriesId === seriesId)
      .slice(0, limit)
      .map((card) => this.toCard(card));
  }

  async listEpisodeSources(episodeId: string): Promise<EpisodeSource[]> {
    const ids = new Set(
      this.cards.filter((card) => card.episodeId === episodeId).flatMap((card) => card.sessionId ?? []),
    );
    return [...ids].map((sessionId) => ({
      sessionId,
      themeId: "shows",
      themeTitle: "shows",
      closedAt: null,
    }));
  }

  async completeNode(episodeId: string, nodeIndex: number) {
    const episode = this.episodes.find((candidate) => candidate.id === episodeId);
    if (!episode || episode.completed.includes(nodeIndex)) return false;
    episode.completed.push(nodeIndex);
    return true;
  }

  async rename(userId: string, seriesId: string, name: string | null) {
    const series = this.series.find((candidate) => candidate.id === seriesId && candidate.userId === userId);
    if (series) series.name = name;
  }

  async setLevel(userId: string, seriesId: string, level: SeriesLevel) {
    const series = this.series.find((candidate) => candidate.id === seriesId && candidate.userId === userId);
    if (series) series.level = level;
  }

  async saveDescription(
    userId: string,
    seriesId: string,
    description: { text: string; basis: { conversations: number; cards: number } },
    now: Date,
  ) {
    const series = this.series.find((candidate) => candidate.id === seriesId && candidate.userId === userId);
    if (!series) return;
    series.description = description.text;
    series.descriptionBasis = description.basis;
    series.descriptionUpdatedAt = now;
  }
}

const PAIR: LanguagePair = { target: "en", native: "pt-BR" };
const WORDS = [
  ["I've been watching it since May", "estou assistindo desde maio"],
  ["the story is beautiful", "a história é linda"],
  ["deep down he is kind", "no fundo ele é gentil"],
  ["what does softie mean", "o que significa softie"],
  ["accents can be tricky", "sotaques podem ser difíceis"],
  ["you will pick up more", "você vai pegar mais"],
] as const;

function setup() {
  const repository = new InMemorySeries();
  WORDS.forEach(([term, translation], index) => repository.terms.set(`item${index}`, { term, translation }));
  const levels = new Map<string, number>();
  const described: DescribeSeriesInput[] = [];
  const xp: { userId: string; sourceId: string; amount: number }[] = [];
  const deps = {
    series: repository,
    levelPercent: async (userId: string) => levels.get(userId) ?? 0,
    describe: async (_userId: string, input: DescribeSeriesInput) => {
      described.push(input);
      return { description: `Foco em ${input.episodes.map((episode) => episode.title).join(" e ")}.` };
    },
    learnerHints: async () => ({
      recentTopics: ["séries"],
      improvements: ["tempos verbais"],
      conversations: 2,
    }),
    clock: new FixedClock("2026-10-16T12:00:00Z"),
    ids: new SequentialIds("p"),
  };
  const lessonDeps = {
    series: repository,
    awardXp: async (input: { userId: string; source: string; sourceId: string; amount: number }) => {
      xp.push({ userId: input.userId, sourceId: input.sourceId, amount: input.amount });
    },
    clock: deps.clock,
    ids: deps.ids,
  };
  return {
    repository,
    levels,
    described,
    xp,
    view: makeGetPersonalSeries(deps),
    context: makeGetSeasonContext(deps),
    place: makePlaceCards(deps),
    rename: makeRenameSeries(deps),
    setLevel: makeSetSeriesLevel(deps),
    describe: makeRefreshSeriesDescription(deps),
    trail: makeGetEpisodeTrail(deps),
    startLesson: makeStartPersonalLesson(lessonDeps),
    completeLesson: makeCompletePersonalLesson(lessonDeps),
  };
}

function rightAnswer(exercise: Exercise): Answer {
  switch (exercise.kind) {
    case "intro":
      return null;
    case "choice":
    case "listen":
    case "blank":
      return exercise.answer;
    case "order":
      return exercise.solution.map((word) => exercise.bank.indexOf(word));
    case "type":
      return correctAnswerText(exercise);
  }
}

const ana = { userId: "ana", pair: PAIR, userLevel: "B1" as const };

describe("série pessoal", () => {
  let app: ReturnType<typeof setup>;

  beforeEach(() => {
    app = setup();
  });

  it("cria a série com id fixo e a temporada do nível na primeira visita, uma por conta e par", async () => {
    const first = await app.view(ana);
    const again = await app.view(ana);
    expect(again.series.id).toBe(first.series.id);
    expect(first.seasons.map((season) => [season.number, season.level])).toEqual([[1, "B1"]]);
    expect(first.upcoming).toMatchObject({ level: "B2", unlockAt: 80 });
    const spanish = await app.view({ ...ana, pair: { target: "es", native: "pt-BR" } });
    expect(spanish.series.id).not.toBe(first.series.id);
  });

  it("distribui os cards por tema na temporada do nível e não repete card", async () => {
    const placed = await app.place({
      ...ana,
      sessionId: "s1",
      cards: [
        { learningItemId: "item0", theme: "Verbos", episodeId: null, episodeTitle: "Verbos I: since e for" },
        { learningItemId: "item1", theme: "Falsos amigos", episodeId: null, episodeTitle: "Falsos amigos I" },
        { learningItemId: "item2", theme: "verbos", episodeId: null, episodeTitle: "outro" },
      ],
    });
    expect(placed).toEqual({ newEpisodes: 2, placed: 3 });
    const context = await app.context(ana);
    expect(context.level).toBe("B1");
    expect(context.episodes.map((episode) => episode.title)).toEqual([
      "Verbos I: since e for",
      "Falsos amigos I",
    ]);
    const verbs = context.episodes[0]?.id ?? "";

    expect(
      await app.place({
        ...ana,
        sessionId: "s2",
        cards: [
          { learningItemId: "item0", theme: "Verbos", episodeId: verbs, episodeTitle: "Verbos I" },
          { learningItemId: "item3", theme: "x", episodeId: verbs, episodeTitle: "Verbos I" },
        ],
      }),
    ).toEqual({ newEpisodes: 0, placed: 1 });
    const view = await app.view(ana);
    expect(
      view.seasons[0]?.episodes.map((episode) => [episode.title, episode.cardCount, episode.sourceCount]),
    ).toEqual([
      ["Verbos I: since e for", 3, 2],
      ["Falsos amigos I", 1, 1],
    ]);
    expect(view.seasons[0]?.episodes[0]?.fresh).toBe(true);
  });

  it("perto de subir de nível, os episódios novos vão para a temporada seguinte", async () => {
    await app.place({
      ...ana,
      sessionId: "s1",
      cards: [{ learningItemId: "item0", theme: "Verbos", episodeId: null, episodeTitle: "Verbos I" }],
    });
    app.levels.set("ana", 85);
    await app.place({
      ...ana,
      sessionId: "s2",
      cards: [
        {
          learningItemId: "item1",
          theme: "Verbos",
          episodeId: null,
          episodeTitle: "Verbos: reuniões e prazos",
        },
      ],
    });
    const view = await app.view(ana);
    expect(view.activeLevel).toBe("B2");
    expect(view.upcoming).toBeNull();
    expect(
      view.seasons.map((season) => [
        season.number,
        season.level,
        season.episodes.map((episode) => episode.title),
      ]),
    ).toEqual([
      [1, "B1", ["Verbos I"]],
      [2, "B2", ["Verbos: reuniões e prazos"]],
    ]);
  });

  it("renomeia e troca o nível sem mudar o id; recusa nome com link e faixa invertida", async () => {
    const { series } = await app.view(ana);
    await app.rename({ ...ana, name: "  Inglês de séries " });
    await expect(app.rename({ ...ana, name: "https://x.test" })).rejects.toMatchObject({
      detail: { key: "seriesNameInvalid" },
    });
    await app.setLevel({ ...ana, level: { mode: "fixed", min: "A2", max: "C1" } });
    await expect(
      app.setLevel({ ...ana, level: { mode: "custom", min: "C1", max: "A2" } }),
    ).rejects.toMatchObject({
      detail: { key: "seriesLevelInvalid" },
    });
    const view = await app.view(ana);
    expect(view.series).toMatchObject({
      id: series.id,
      name: "Inglês de séries",
      level: { mode: "fixed", min: "A2", max: null },
    });
    expect(view.activeLevel).toBe("A2");
    await app.rename({ ...ana, name: "" });
    expect((await app.view(ana)).series.name).toBeNull();
  });

  it("a IA escreve a descrição a partir dos episódios e do contexto da pessoa", async () => {
    expect(await app.describe(ana)).toBe(false);
    await app.place({
      ...ana,
      sessionId: "s1",
      cards: [{ learningItemId: "item0", theme: "Verbos", episodeId: null, episodeTitle: "Verbos I" }],
    });
    expect(await app.describe(ana)).toBe(true);
    expect(app.described[0]).toEqual({
      level: "B1",
      episodes: [{ title: "Verbos I", cards: 1 }],
      recentTopics: ["séries"],
      improvements: ["tempos verbais"],
    });
    expect((await app.view(ana)).series).toMatchObject({
      description: "Foco em Verbos I.",
      descriptionBasis: { conversations: 2, cards: 1 },
    });
  });

  it("um usuário não vê, não estuda nem mexe na série do outro", async () => {
    await app.place({
      ...ana,
      sessionId: "s1",
      cards: [{ learningItemId: "item0", theme: "Verbos", episodeId: null, episodeTitle: "Verbos I" }],
    });
    const episodeId = (await app.context(ana)).episodes[0]?.id ?? "";
    const lucas = { userId: "lucas", pair: PAIR, userLevel: "C1" as const };
    await expect(app.trail({ ...lucas, episodeId })).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
    await expect(app.startLesson({ ...lucas, level: "C1", episodeId, nodeIndex: 0 })).rejects.toMatchObject({
      code: "ITEM_NOT_FOUND",
    });
    expect((await app.view(lucas)).seasons[0]?.episodes).toEqual([]);
    expect((await app.context(lucas)).episodes).toEqual([]);
  });

  it("estuda um bloco do episódio: lição dos cards, XP uma vez e o bloco seguinte liberado", async () => {
    await app.place({
      ...ana,
      sessionId: "s1",
      cards: WORDS.map((_, index) => ({
        learningItemId: `item${index}`,
        theme: "Séries",
        episodeId: null,
        episodeTitle: "Séries I",
      })),
    });
    const episodeId = (await app.context(ana)).episodes[0]?.id ?? "";
    const trail = await app.trail({ ...ana, episodeId });
    expect(trail.nodes.map((node) => node.state)).toEqual(["current", "locked"]);
    await expect(app.startLesson({ ...ana, level: "B1", episodeId, nodeIndex: 1 })).rejects.toMatchObject({
      code: "EPISODE_NOT_READY",
    });

    const lesson = await app.startLesson({ ...ana, level: "B1", episodeId, nodeIndex: 0 });
    expect(lesson.exercises.length).toBeGreaterThan(0);
    expect(new Set(lesson.exercises.map((exercise) => exercise.cueId)).size).toBeGreaterThan(1);
    const answers = lesson.exercises.map(rightAnswer);
    const result = await app.completeLesson({
      ...ana,
      level: "B1",
      episodeId,
      nodeIndex: 0,
      seed: lesson.seed,
      answers,
    });
    expect(result).toMatchObject({ passed: true, replay: false, progressPercent: 50, nextNodeIndex: 1 });
    expect(app.xp).toEqual([{ userId: "ana", sourceId: `${episodeId}:0`, amount: result.xp }]);

    const replay = await app.startLesson({ ...ana, level: "B1", episodeId, nodeIndex: 0 });
    const again = await app.completeLesson({
      ...ana,
      level: "B1",
      episodeId,
      nodeIndex: 0,
      seed: replay.seed,
      answers: replay.exercises.map(rightAnswer),
    });
    expect(again).toMatchObject({ replay: true, xp: 0 });
    await expect(
      app.completeLesson({ ...ana, level: "B1", episodeId, nodeIndex: 0, seed: replay.seed, answers: [] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
