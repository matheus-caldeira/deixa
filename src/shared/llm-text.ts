const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;
const LINK_OR_MARKUP = /<|>|https?:|www\.|\[[^\]]*\]\(/i;

export function cleanLlmText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length === 0 || cleaned.length > maxLength || LINK_OR_MARKUP.test(cleaned)) return null;
  return cleaned;
}
