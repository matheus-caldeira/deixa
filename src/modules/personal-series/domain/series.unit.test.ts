import { describe, expect, it } from "vitest";
import {
  MAX_CARDS_PER_EPISODE,
  activeLevel,
  cleanSeriesName,
  episodeNodes,
  normalizeTheme,
  planPlacements,
  progressPercent,
  upcomingSeason,
  validLevel,
  type Episode,
} from "./series";

const auto = { mode: "auto", min: null, max: null } as const;

function episode(overrides: Partial<Episode>): Episode {
  return {
    id: "e1",
    seasonId: "s1",
    number: 1,
    title: "Verbos I: presente e passado",
    theme: "verbos",
    part: 1,
    cardCount: 0,
    sourceCount: 0,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

describe("série pessoal: temporada por nível", () => {
  it("normaliza o tema sem acento, caixa ou pontuação", () => {
    expect(normalizeTheme("  Falsos Amigos!  ")).toBe("falsos-amigos");
    expect(normalizeTheme("Pronúncia & ritmo")).toBe("pronuncia-ritmo");
  });

  it("a temporada ativa acompanha o nível e passa para o próximo perto de subir", () => {
    expect(activeLevel({ level: auto, userLevel: "B1", levelPct: 79 })).toBe("B1");
    expect(activeLevel({ level: auto, userLevel: "B1", levelPct: 80 })).toBe("B2");
    expect(activeLevel({ level: auto, userLevel: "C2", levelPct: 95 })).toBe("C2");
  });

  it("nível fixo prende a temporada; customizado fica dentro da faixa", () => {
    const fixed = { mode: "fixed", min: "A2", max: null } as const;
    expect(activeLevel({ level: fixed, userLevel: "C1", levelPct: 99 })).toBe("A2");
    const custom = { mode: "custom", min: "A2", max: "B1" } as const;
    expect(activeLevel({ level: custom, userLevel: "A1", levelPct: 0 })).toBe("A2");
    expect(activeLevel({ level: custom, userLevel: "A2", levelPct: 90 })).toBe("B1");
    expect(activeLevel({ level: custom, userLevel: "B1", levelPct: 90 })).toBe("B1");
    expect(activeLevel({ level: custom, userLevel: "C1", levelPct: 10 })).toBe("B1");
  });

  it("mostra a próxima temporada travada com os temas mais fortes da atual", () => {
    const seasons = [{ id: "s1", number: 1, level: "B1" as const }];
    const episodes = [
      episode({ id: "a", title: "Verbos II: since e for", cardCount: 3 }),
      episode({ id: "b", title: "Falsos amigos I", theme: "falsos-amigos", cardCount: 8 }),
    ];
    expect(upcomingSeason({ level: auto, userLevel: "B1", levelPct: 62, seasons, episodes })).toEqual({
      level: "B2",
      percent: 62,
      unlockAt: 80,
      themes: ["Falsos amigos", "Verbos"],
    });
    expect(upcomingSeason({ level: auto, userLevel: "B1", levelPct: 85, seasons, episodes })).toBeNull();
    const fixed = { mode: "fixed", min: "B1", max: null } as const;
    expect(upcomingSeason({ level: fixed, userLevel: "B1", levelPct: 10, seasons, episodes })).toBeNull();
  });
});

describe("série pessoal: distribuição dos cards por tema", () => {
  it("usa o episódio indicado, depois o do mesmo tema, e abre episódio novo para tema novo", () => {
    const existing = [
      { id: "verbs", theme: "verbos", part: 1, title: "Verbos I", cardCount: 2 },
      { id: "friends", theme: "falsos-amigos", part: 1, title: "Falsos amigos I", cardCount: 1 },
    ];
    const plan = planPlacements({
      episodes: existing,
      requests: [
        { key: "a", theme: "qualquer", episodeId: "friends", episodeTitle: "x" },
        { key: "b", theme: "Verbos", episodeId: "inventado", episodeTitle: "Verbos I" },
        { key: "c", theme: "Phrasal verbs", episodeId: null, episodeTitle: "Phrasal verbs I: no trabalho" },
        { key: "d", theme: "phrasal verbs", episodeId: null, episodeTitle: "Outro título" },
      ],
    });
    expect(plan.newEpisodes).toEqual([
      { ref: "new:phrasal-verbs:1", theme: "phrasal-verbs", part: 1, title: "Phrasal verbs I: no trabalho" },
    ]);
    expect(plan.assignments).toEqual([
      { key: "a", target: { kind: "existing", episodeId: "friends" } },
      { key: "b", target: { kind: "existing", episodeId: "verbs" } },
      { key: "c", target: { kind: "new", ref: "new:phrasal-verbs:1" } },
      { key: "d", target: { kind: "new", ref: "new:phrasal-verbs:1" } },
    ]);
  });

  it("episódio cheio continua na parte seguinte do mesmo tema", () => {
    const full = [
      {
        id: "v1",
        theme: "verbos",
        part: 1,
        title: "Verbos I: presente",
        cardCount: MAX_CARDS_PER_EPISODE - 1,
      },
    ];
    const plan = planPlacements({
      episodes: full,
      requests: ["a", "b", "c"].map((key) => ({
        key,
        theme: "Verbos",
        episodeId: "v1",
        episodeTitle: "Verbos I",
      })),
    });
    expect(plan.assignments.map((assignment) => assignment.target)).toEqual([
      { kind: "existing", episodeId: "v1" },
      { kind: "new", ref: "new:verbos:2" },
      { kind: "new", ref: "new:verbos:2" },
    ]);
    expect(plan.newEpisodes).toEqual([{ ref: "new:verbos:2", theme: "verbos", part: 2, title: "Verbos II" }]);
  });
});

describe("série pessoal: trilha do episódio", () => {
  it("divide os cards em blocos de quatro e libera um bloco por vez", () => {
    const cards = Array.from({ length: 9 }, (_, index) => ({
      learningItemId: `i${index}`,
      term: `t${index}`,
      translation: null,
    }));
    const nodes = episodeNodes(cards, new Set([0]));
    expect(nodes.map((node) => [node.cardCount, node.state])).toEqual([
      [4, "done"],
      [4, "current"],
      [1, "locked"],
    ]);
    expect(nodes[0]?.title).toBe("t0 · t1 · t2 · t3");
    expect(progressPercent(cards.length, new Set([0, 7]))).toBe(33);
    expect(episodeNodes([], new Set())).toEqual([]);
  });

  it("valida nome e nível escolhidos pela pessoa", () => {
    expect(cleanSeriesName("  Meu   inglês  ")).toBe("Meu inglês");
    expect(cleanSeriesName("veja https://x.test")).toBeNull();
    expect(cleanSeriesName("x".repeat(41))).toBeNull();
    expect(validLevel({ mode: "fixed", min: null, max: null })).toBe(false);
    expect(validLevel({ mode: "custom", min: "B2", max: "A2" })).toBe(false);
    expect(validLevel({ mode: "custom", min: "A2", max: "B2" })).toBe(true);
  });
});
