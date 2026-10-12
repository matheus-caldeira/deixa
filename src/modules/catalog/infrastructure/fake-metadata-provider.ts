import { AppError } from "@/shared/errors";
import type { CefrLevel } from "@/shared/levels";
import type { MediaType, PosterColors } from "../domain/catalog";
import type {
  EpisodeMetadata,
  MetadataProvider,
  WorkCandidate,
  WorkDetails,
  WorkSummary,
} from "../application/ports";

type FakeWork = {
  slug: string;
  title: string;
  type: MediaType;
  year: number;
  levels: readonly [CefrLevel, CefrLevel];
  accent: string;
  colors: PosterColors;
  overview: string;
  runtimeMinutes: number;
  genres: readonly string[];
  seasons: Record<number, string[]>;
};

const FAKE_WORKS: readonly FakeWork[] = [
  {
    slug: "friends",
    title: "Friends",
    type: "series",
    year: 1994,
    levels: ["A1", "B1"],
    accent: "EUA",
    colors: { c1: "#7B3FE4", c2: "#F3B61F", fg: "#fff" },
    overview:
      "Seis amigos em Nova York. Diálogo lento, situações do dia a dia e muita repetição: ótimo para começar.",
    runtimeMinutes: 22,
    genres: ["Comédia"],
    seasons: {
      1: [
        "The One Where Monica Gets a Roommate",
        "The One with the Sonogram at the End",
        "The One with the Thumb",
        "The One with George Stephanopoulos",
        "The One with the East German Laundry Detergent",
      ],
    },
  },
  {
    slug: "himym",
    title: "How I Met Your Mother",
    type: "series",
    year: 2005,
    levels: ["A2", "B2"],
    accent: "EUA",
    colors: { c1: "#13305C", c2: "#E8A33D", fg: "#fff" },
    overview:
      "Ted conta aos filhos como conheceu a mãe deles. Gírias de bar, expressões informais e falas rápidas.",
    runtimeMinutes: 22,
    genres: ["Comédia", "Romance"],
    seasons: {
      1: ["Pilot", "Purple Giraffe", "Sweet Taste of Liberty", "Return of the Shirt", "Okay Awesome"],
      2: ["Where Were We?"],
    },
  },
  {
    slug: "office",
    title: "The Office",
    type: "series",
    year: 2005,
    levels: ["B1", "C1"],
    accent: "EUA",
    colors: { c1: "#E9E4D8", c2: "#5A6B7D", fg: "#1D2430" },
    overview: "Documentário falso num escritório. Humor constrangedor, ironia e linguagem corporativa.",
    runtimeMinutes: 22,
    genres: ["Comédia"],
    seasons: { 1: ["Pilot", "Diversity Day", "Health Care"] },
  },
  {
    slug: "tedlasso",
    title: "Ted Lasso",
    type: "series",
    year: 2020,
    levels: ["B2", "C2"],
    accent: "EUA + Reino Unido",
    colors: { c1: "#0B5D3B", c2: "#F2D16B", fg: "#fff" },
    overview:
      "Um técnico americano num clube inglês. Contraste de sotaques, gírias britânicas e muita ironia.",
    runtimeMinutes: 30,
    genres: ["Comédia", "Drama"],
    seasons: { 1: ["Pilot", "Biscuits", "Trent Crimm: The Independent"] },
  },
  {
    slug: "bb",
    title: "Breaking Bad",
    type: "series",
    year: 2008,
    levels: ["B2", "C1"],
    accent: "EUA",
    colors: { c1: "#1E3B1A", c2: "#C9D86B", fg: "#fff" },
    overview: "Professor de química vira fabricante de drogas. Vocabulário técnico, tensão e falas curtas.",
    runtimeMinutes: 48,
    genres: ["Drama", "Crime"],
    seasons: { 1: ["Pilot", "Cat's in the Bag..."] },
  },
  {
    slug: "prada",
    title: "The Devil Wears Prada",
    type: "movie",
    year: 2006,
    levels: ["B1", "B2"],
    accent: "EUA",
    colors: { c1: "#B31B34", c2: "#111", fg: "#fff" },
    overview:
      "Uma jornalista recém-formada vira assistente de uma editora temida. Inglês de trabalho, moda e pressão.",
    runtimeMinutes: 109,
    genres: ["Comédia", "Drama"],
    seasons: {},
  },
  {
    slug: "socialnetwork",
    title: "The Social Network",
    type: "movie",
    year: 2010,
    levels: ["C1", "C2"],
    accent: "EUA",
    colors: { c1: "#0D1B2A", c2: "#4C8BF5", fg: "#fff" },
    overview: "A criação de uma rede social. Diálogos muito rápidos e densos: desafio de escuta.",
    runtimeMinutes: 120,
    genres: ["Drama", "História"],
    seasons: {},
  },
  {
    slug: "modernfamily",
    title: "Modern Family",
    type: "series",
    year: 2009,
    levels: ["B1", "B2"],
    accent: "EUA",
    colors: { c1: "#3BA3D9", c2: "#F7E26B", fg: "#fff" },
    overview: "Três núcleos de uma mesma família contados em formato de falso documentário.",
    runtimeMinutes: 22,
    genres: ["Comédia", "Família"],
    seasons: {
      1: ["Pilot", "The Bicycle Thief", "Come Fly with Me", "The Incident", "Coal Digger"],
      2: ["The Old Wagon", "The Kiss"],
    },
  },
  {
    slug: "b99",
    title: "Brooklyn Nine-Nine",
    type: "series",
    year: 2013,
    levels: ["B1", "B2"],
    accent: "EUA",
    colors: { c1: "#1A2A4F", c2: "#F2C94C", fg: "#fff" },
    overview: "O dia a dia de uma delegacia do Brooklyn, com piadas rápidas e muito trocadilho.",
    runtimeMinutes: 22,
    genres: ["Comédia", "Crime"],
    seasons: { 1: ["Pilot", "The Tagger", "The Slump"] },
  },
  {
    slug: "suits",
    title: "Suits",
    type: "series",
    year: 2011,
    levels: ["B2", "C1"],
    accent: "EUA",
    colors: { c1: "#20262E", c2: "#C7A76C", fg: "#fff" },
    overview: "Um escritório de advocacia em Nova York. Inglês jurídico, negociações e respostas afiadas.",
    runtimeMinutes: 43,
    genres: ["Drama", "Crime"],
    seasons: { 1: ["Pilot", "Errors and Omissions", "Inside Track"] },
  },
];

const EXTERNAL_PREFIX = "fake-";

function toSummary(work: FakeWork): WorkSummary {
  return {
    provider: "fake",
    externalId: `${EXTERNAL_PREFIX}${work.slug}`,
    type: work.type,
    title: work.title,
    originalTitle: work.title,
    overview: work.overview,
    year: work.year,
    posterPath: null,
    posterColors: work.colors,
  };
}

function toCandidate(work: FakeWork, position: number): WorkCandidate {
  return {
    ...toSummary(work),
    genres: [...work.genres],
    originalLanguage: "en",
    popularity: FAKE_WORKS.length - position,
  };
}

function findWork(externalId: string): FakeWork {
  const work = FAKE_WORKS.find((candidate) => `${EXTERNAL_PREFIX}${candidate.slug}` === externalId);
  if (!work) throw new AppError("METADATA_NOT_FOUND");
  return work;
}

export class FakeMetadataProvider implements MetadataProvider {
  readonly name = "fake" as const;
  readonly calls = { search: 0, work: 0, season: 0 };

  async searchWorks(query: string): Promise<WorkSummary[]> {
    this.calls.search += 1;
    const needle = query.trim().toLowerCase();
    return FAKE_WORKS.filter((work) => work.title.toLowerCase().includes(needle)).map(toSummary);
  }

  async getWork(type: MediaType, externalId: string): Promise<WorkDetails> {
    this.calls.work += 1;
    const work = findWork(externalId);
    if (work.type !== type) throw new AppError("METADATA_NOT_FOUND");
    return {
      ...toSummary(work),
      runtimeMinutes: work.runtimeMinutes,
      levelRange: work.levels,
      accent: work.accent,
      seasons: Object.entries(work.seasons).map(([seasonNumber, titles]) => ({
        seasonNumber: Number(seasonNumber),
        title: `Temporada ${seasonNumber}`,
        episodeCount: titles.length,
      })),
    };
  }

  async listRelatedWorks(type: MediaType, externalId: string): Promise<WorkCandidate[]> {
    const origin = FAKE_WORKS.find((work) => `${EXTERNAL_PREFIX}${work.slug}` === externalId);
    if (!origin || origin.type !== type) return [];
    return FAKE_WORKS.flatMap((work, position) =>
      work !== origin && work.genres.some((genre) => origin.genres.includes(genre))
        ? [toCandidate(work, position)]
        : [],
    );
  }

  async listPopularWorks(): Promise<WorkCandidate[]> {
    return FAKE_WORKS.map(toCandidate);
  }

  async getSeasonEpisodes(externalId: string, seasonNumber: number): Promise<EpisodeMetadata[]> {
    this.calls.season += 1;
    const work = findWork(externalId);
    const titles = work.seasons[seasonNumber];
    if (!titles) throw new AppError("METADATA_NOT_FOUND");
    return titles.map((title, index) => ({
      episodeNumber: index + 1,
      title,
      overview: "",
      runtimeMinutes: work.runtimeMinutes,
    }));
  }
}

export function fakeExternalId(slug: string): string {
  return `${EXTERNAL_PREFIX}${slug}`;
}

export function demoWorkNotes(title: string): { overview: string; genres: string[] } | null {
  const work = FAKE_WORKS.find((candidate) => candidate.title === title);
  return work ? { overview: work.overview, genres: [...work.genres] } : null;
}
