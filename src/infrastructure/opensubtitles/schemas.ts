import { z } from "zod";

const looseNumber = z.preprocess(
  (value) => (value === null || value === undefined || value === "" ? undefined : Number(value)),
  z.number().finite().optional(),
);
const looseFlag = z.preprocess((value) => value === true, z.boolean());
const looseText = z.preprocess((value) => (typeof value === "string" ? value : ""), z.string());

export const searchSchema = z.object({
  data: z
    .array(
      z.object({
        attributes: z.object({
          language: looseText,
          download_count: looseNumber,
          hearing_impaired: looseFlag,
          fps: looseNumber,
          ratings: looseNumber,
          ai_translated: looseFlag,
          machine_translated: looseFlag,
          release: looseText,
          uploader: z.preprocess(
            (value) => (value && typeof value === "object" ? value : {}),
            z.object({ name: looseText }),
          ),
          files: z.preprocess(
            (value) => (Array.isArray(value) ? value : []),
            z.array(z.object({ file_id: z.union([z.number(), z.string()]), file_name: looseText })),
          ),
        }),
      }),
    )
    .default([]),
});

export const downloadSchema = z.object({
  link: z.string().min(1),
  file_name: looseText,
  remaining: looseNumber,
  reset_time_utc: z.preprocess(
    (value) => (typeof value === "string" ? value : undefined),
    z.string().optional(),
  ),
});

export const quotaSchema = z.object({
  remaining: looseNumber,
  reset_time_utc: z.preprocess(
    (value) => (typeof value === "string" ? value : undefined),
    z.string().optional(),
  ),
});

export const loginSchema = z.object({ token: z.string().min(1) });

export type SearchResponse = z.infer<typeof searchSchema>;
