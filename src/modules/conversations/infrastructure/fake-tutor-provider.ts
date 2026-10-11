import type { TurnRole } from "../domain/conversation";
import type { TutorMessage, TutorProvider } from "../application/conversation-use-cases";

const RULES: readonly [RegExp, string, string][] = [
  [/\bi want\b/i, "I'd like", '"I want" soa direto demais para pedidos. "I\'d like" é o educado.'],
  [/\bpeoples\b/i, "people", '"People" já é plural.'],
  [/\bi am agree\b/i, "I agree", '"Agree" é verbo: não usa "am".'],
  [/\bhe go\b/i, "he goes", "Terceira pessoa no presente leva -s."],
  [/\bdid you went\b/i, "did you go", 'Depois de "did", o verbo volta à forma base.'],
  [/\bmore better\b/i, "better", '"Better" já é comparativo.'],
];

const FOLLOW_UPS = [
  "Interesting! Can you tell me a bit more about that?",
  "I see. Why do you think that is?",
  "Got it. What happened next?",
  "That makes sense. How did you feel about it?",
];

export class FakeTutorProvider implements TutorProvider {
  readonly name = "fake" as const;
  readonly calls: { kind: "reply" | "review"; theme: string }[] = [];

  async reply(input: {
    theme: string;
    history: { role: TurnRole; text: string }[];
    message: TutorMessage;
  }): Promise<unknown> {
    this.calls.push({ kind: "reply", theme: input.theme });
    const text = "text" in input.message ? input.message.text : "I recorded an audio message.";
    const corrections = RULES.flatMap(([pattern, right, why]) => {
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

  async review(input: { theme: string; turns: { role: TurnRole; text: string }[] }): Promise<unknown> {
    this.calls.push({ kind: "review", theme: input.theme });
    const mine = input.turns.filter((turn) => turn.role === "user");
    const phrases = mine.flatMap((turn) =>
      RULES.flatMap(([pattern, right, why]) => {
        const match = turn.text.match(pattern);
        return match ? [{ wrong: match[0], right, why }] : [];
      }),
    );
    return {
      summary: `Revisão simulada: você enviou ${mine.length} mensagens sobre ${input.theme}.`,
      score: Math.max(40, 90 - phrases.length * 10),
      strengths: ["Você manteve a conversa andando."],
      improvements:
        phrases.length > 0 ? ["Reveja as frases corrigidas abaixo."] : ["Tente frases mais longas."],
      phrases,
    };
  }
}
