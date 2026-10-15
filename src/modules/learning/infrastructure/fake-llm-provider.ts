import type { LanguagePair } from "@/shared/study-languages";
import { normalizeTerm } from "@/shared/text";
import type { ItemType } from "../domain/learning";
import type { ExplainRequest, LlmProvider } from "../application/ports";

const GLOSSARY: Record<string, string> = {
  "up to": "fazendo / planejando (informal)",
  "what are you up to": "o que você está fazendo / vai fazer?",
  tonight: "hoje à noite",
  "nothing much": "nada demais",
  "stay in": "ficar em casa",
  "catch up on": "pôr em dia",
  "catch up": "pôr em dia, alcançar",
  "catch up on some sleep": "colocar o sono em dia",
  sleep: "dormir; sono",
  gonna: '"going to" falado: vai, ia',
  "come on": "qual é / vamos lá",
  "hang out": "sair, passar tempo junto",
  fine: "tá bom",
  "staying out late": "ficar fora até tarde",
  late: "tarde",
  morning: "manhã",
  "i've got": "eu tenho (informal)",
  deal: "fechado, combinado",
  round: "rodada (de bebidas)",
  "first round's on me": "a primeira rodada é por minha conta",
  "on me": "por minha conta",
  date: "encontro romântico",
  honestly: "sinceramente",
  disaster: "desastre",
  total: "total, completo",
  whole: "inteiro(a)",
  spent: "passou (tempo); gastou",
  phone: "celular",
  ouch: "ai! (dor ou constrangimento)",
  "at least": "pelo menos",
  "split the bill": "dividir a conta",
  split: "dividir",
  bill: "conta",
  nope: "não (informal)",
  "picked up the tab": "pagou a conta (de todos)",
  "picked up": "pegou; pagou (a conta)",
  tab: "conta (de bar ou restaurante)",
  idiot: "idiota",
  "don't beat yourself up": "não se culpe",
  "beat yourself up": "se culpar, se martirizar",
  happens: "acontece",
  everyone: "todo mundo",
  wait: "espera",
  "no way": "não acredito! / de jeito nenhum",
  "haven't seen": "não vejo / não vi",
  college: "faculdade",
  "say hi": "dar oi",
  should: "deveria",
  worst: "pior",
  pretend: "fingir",
  remember: "lembrar",
  "play it cool": "agir com naturalidade, não demonstrar ansiedade",
  overthink: "pensar demais",
  believe: "acreditar",
  "ran into": "esbarrou com, encontrou por acaso",
  "after all these years": "depois de tantos anos",
  "ask her out": "chamar ela pra sair",
  "ask out": "chamar pra sair (encontro)",
  rush: "apressar",
  "rush things": "apressar as coisas",
  dude: "cara, mano",
  text: "mandar mensagem",
  tomorrow: "amanhã",
  promise: "prometer; promessa",
  "promise?": "Promete?",
  "call it a night": "encerrar a noite, ir embora",
};

const PARTICLES = new Set(["up", "out", "in", "on", "off", "into", "over", "down", "away", "back"]);
const SLANG = new Set(["dude", "nope", "gonna", "wanna", "ouch", "yeah"]);
const PHRASAL_VERB_WORDS = 2;

function guessType(kind: "word" | "phrase" | "line", term: string): ItemType {
  if (kind === "line") return "sentence";
  const words = normalizeTerm(term).split(" ");
  if (kind === "word") return SLANG.has(words[0] ?? "") ? "slang" : "word";
  const hasParticle = words.slice(1).some((word) => PARTICLES.has(word));
  return words.length <= PHRASAL_VERB_WORDS + 1 && hasParticle ? "phrasal_verb" : "expression";
}

function fakeMeaning(term: string): string {
  const key = normalizeTerm(term);
  const exact = GLOSSARY[key];
  if (exact) return exact;
  const parts = key
    .split(" ")
    .map((word) => GLOSSARY[word])
    .filter((meaning) => meaning !== undefined);
  if (parts.length > 0) return parts.join(" + ");
  return `Explicação simulada de "${term}" no contexto da cena.`;
}

export function fakeTranslation(text: string): string {
  return GLOSSARY[normalizeTerm(text)] ?? `[tradução simulada] ${text}`;
}

export class FakeLlmProvider implements LlmProvider {
  readonly name = "fake" as const;
  readonly requests: ExplainRequest[] = [];
  translationCalls = 0;

  async explainTerms(request: ExplainRequest): Promise<unknown> {
    this.requests.push(request);
    return request.items.map((item) => ({
      id: item.id,
      meaning: item.kind === "line" ? fakeTranslation(item.lineText) : fakeMeaning(item.term),
      itemType: guessType(item.kind, item.term),
      difficulty: item.kind === "word" ? "A2" : item.kind === "phrase" ? "B1" : request.learnerLevel,
      pronunciation: null,
      exampleEnglish: item.kind === "line" ? null : item.lineText,
      examplePortuguese: item.kind === "line" ? null : item.lineTranslation,
      lineTranslation: item.lineTranslation ? null : fakeTranslation(item.lineText),
    }));
  }

  async translateLines(lines: { id: string; text: string }[], _pair: LanguagePair): Promise<unknown> {
    this.translationCalls += 1;
    return lines.map((line) => ({ id: line.id, translation: fakeTranslation(line.text) }));
  }
}
