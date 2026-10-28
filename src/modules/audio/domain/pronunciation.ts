export type WordCheck = { word: string; heard: boolean };
export type PronunciationResult = { words: WordCheck[]; extra: number; score: number };

const FULL_SCORE = 100;

export function spokenWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 0);
}

export function comparePronunciation(expected: string, heard: string): PronunciationResult {
  const original = expected.split(/\s+/).filter((word) => spokenWords(word).length > 0);
  const target = original.map((word) => spokenWords(word).join(" "));
  const said = spokenWords(heard);
  const lengths = Array.from({ length: target.length + 1 }, () => new Array<number>(said.length + 1).fill(0));
  for (let i = target.length - 1; i >= 0; i -= 1) {
    for (let j = said.length - 1; j >= 0; j -= 1) {
      lengths[i]![j] =
        target[i] === said[j]
          ? lengths[i + 1]![j + 1]! + 1
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }
  const words: WordCheck[] = [];
  let i = 0;
  let j = 0;
  while (i < target.length) {
    if (j < said.length && target[i] === said[j]) {
      words.push({ word: original[i]!, heard: true });
      i += 1;
      j += 1;
    } else if (j < said.length && lengths[i]![j + 1]! >= lengths[i + 1]![j]!) {
      j += 1;
    } else {
      words.push({ word: original[i]!, heard: false });
      i += 1;
    }
  }
  const matched = words.filter((word) => word.heard).length;
  return {
    words,
    extra: said.length - matched,
    score: target.length === 0 ? 0 : Math.round((matched / target.length) * FULL_SCORE),
  };
}
