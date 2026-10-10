const EDGE_PUNCTUATION = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;
const CURLY_APOSTROPHES = /[’‘]/g;

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

export function cleanToken(token: string): string {
  return token.replace(CURLY_APOSTROPHES, "'").replace(EDGE_PUNCTUATION, "");
}

export function termFromTokens(tokens: readonly string[], start: number, end: number): string {
  return tokens
    .slice(start, end + 1)
    .map(cleanToken)
    .filter((token) => token.length > 0)
    .join(" ");
}

export function normalizeTerm(term: string): string {
  return term.replace(CURLY_APOSTROPHES, "'").toLowerCase().replace(/\s+/g, " ").trim();
}
