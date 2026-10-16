import type { SeasonContext, TurnRole } from "../domain/conversation";
import type { TutorMessage, TutorProvider } from "../application/conversation-use-cases";

type Rule = { pattern: RegExp; right: string; why: string; theme: string; translation: string };

const RULES: readonly Rule[] = [
  {
    pattern: /\bi want\b/i,
    right: "I'd like",
    why: '"I want" soa direto demais para pedidos. "I\'d like" é o educado.',
    theme: "Pedidos educados",
    translation: "eu gostaria",
  },
  {
    pattern: /\bpeoples\b/i,
    right: "people",
    why: '"People" já é plural.',
    theme: "Plural",
    translation: "pessoas",
  },
  {
    pattern: /\bi am agree\b/i,
    right: "I agree",
    why: '"Agree" é verbo: não usa "am".',
    theme: "Verbos",
    translation: "eu concordo",
  },
  {
    pattern: /\bhe go\b/i,
    right: "he goes",
    why: "Terceira pessoa no presente leva -s.",
    theme: "Verbos",
    translation: "ele vai",
  },
  {
    pattern: /\bdid you went\b/i,
    right: "did you go",
    why: 'Depois de "did", o verbo volta à forma base.',
    theme: "Verbos",
    translation: "você foi",
  },
  {
    pattern: /\bmore better\b/i,
    right: "better",
    why: '"Better" já é comparativo.',
    theme: "Comparativos",
    translation: "melhor",
  },
];

const FOLLOW_UPS = [
  "Interesting! Can you tell me a bit more about that?",
  "I see. Why do you think that is?",
  "Got it. What happened next?",
  "That makes sense. How did you feel about it?",
];

function episodeFor(
  season: SeasonContext,
  theme: string,
): { episodeId: string | null; episodeTitle: string } {
  const known = season.episodes.find((episode) =>
    episode.title.toLowerCase().startsWith(theme.toLowerCase()),
  );
  return known
    ? { episodeId: known.id, episodeTitle: known.title }
    : { episodeId: null, episodeTitle: theme };
}

export class FakeTutorProvider implements TutorProvider {
  readonly name = "fake" as const;
  readonly calls: { kind: "reply" | "review" | "terms" | "series"; theme: string }[] = [];

  async reply(input: {
    theme: string;
    history: { role: TurnRole; text: string }[];
    message: TutorMessage;
  }): Promise<unknown> {
    this.calls.push({ kind: "reply", theme: input.theme });
    const text = "text" in input.message ? input.message.text : "I recorded an audio message.";
    const corrections = RULES.flatMap(({ pattern, right, why }) => {
      const match = text.match(pattern);
      return match ? [{ wrong: match[0], right, why }] : [];
    });
    const userTurns = input.history.filter((turn) => turn.role === "user").length;
    return {
      transcript: "audio" in input.message ? text : null,
      reply: FOLLOW_UPS[userTurns % FOLLOW_UPS.length],
      replyTranslation: null,
      corrections,
    };
  }

  async review(input: {
    theme: string;
    turns: { index: number; role: TurnRole; text: string }[];
    season: SeasonContext;
  }): Promise<unknown> {
    this.calls.push({ kind: "review", theme: input.theme });
    const mine = input.turns.filter((turn) => turn.role === "user");
    const found = mine.flatMap((turn) =>
      RULES.flatMap((rule) => {
        const match = turn.text.match(rule.pattern);
        return match ? [{ turn, match: match[0], rule }] : [];
      }),
    );
    return {
      summary: `Revisão simulada: você enviou ${mine.length} mensagens sobre ${input.theme}.`,
      score: Math.max(40, 90 - found.length * 10),
      strengths: ["Você manteve a conversa andando."],
      improvements:
        found.length > 0 ? ["Reveja as frases corrigidas abaixo."] : ["Tente frases mais longas."],
      corrected: found.map(({ turn, match, rule }) => ({
        turn: turn.index,
        text: turn.text.replace(match, rule.right),
      })),
      difficulties: found.map(({ turn, match, rule }) => ({
        kind: "grammar",
        turn: turn.index,
        said: match,
        target: rule.right,
        translation: rule.translation,
        why: rule.why,
        theme: rule.theme,
        ...episodeFor(input.season, rule.theme),
      })),
    };
  }

  async explainTerms(input: {
    theme: string;
    terms: { term: string; sentence: string }[];
    season: SeasonContext;
  }): Promise<unknown> {
    this.calls.push({ kind: "terms", theme: input.theme });
    const theme = "Vocabulário das conversas";
    return {
      terms: input.terms.map(({ term }) => ({
        term,
        translation: `significado de "${term}" (simulado)`,
        why: null,
        theme,
        ...episodeFor(input.season, theme),
      })),
    };
  }

  async describeSeries(input: {
    level: string;
    episodes: { title: string; cards: number }[];
  }): Promise<unknown> {
    this.calls.push({ kind: "series", theme: input.level });
    const titles = input.episodes.map((episode) => episode.title).slice(0, 3);
    return {
      description: `Série simulada para o nível ${input.level}: ${titles.join(", ")}.`,
    };
  }
}
