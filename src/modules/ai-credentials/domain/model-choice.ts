import { z } from "zod";
import { AI_SERVICES } from "./services";

const MODEL_ID = /^[\w.:/@-]{2,120}$/;

export const modelChoiceSchema = z.object({
  provider: z.enum(AI_SERVICES),
  model: z.string().trim().regex(MODEL_ID),
});
export type ModelChoice = z.infer<typeof modelChoiceSchema>;

export const aiModelsSchema = z.object({
  generation: modelChoiceSchema.nullable(),
  embedding: z.union([modelChoiceSchema, z.literal("local")]).nullable(),
});
export type AiModels = z.infer<typeof aiModelsSchema>;

export const NO_MODEL_CHOICE: AiModels = { generation: null, embedding: null };

export const SUGGESTED_MODELS: Record<
  (typeof AI_SERVICES)[number],
  { generation: string; embedding: string | null }
> = {
  gemini: { generation: "gemini-2.5-flash", embedding: "gemini-embedding-001" },
  openai: { generation: "gpt-4o-mini", embedding: "text-embedding-3-small" },
  anthropic: { generation: "claude-haiku-4-5", embedding: null },
  openrouter: { generation: "google/gemini-2.5-flash", embedding: "openai/text-embedding-3-small" },
  ollama: { generation: "llama3.1", embedding: "nomic-embed-text" },
  openai_compatible: { generation: "", embedding: "" },
};
