import { z } from "zod";

export const BROWSER_DATA_DIR = "idb://deixa";
export const DATABASE_LOCK = "deixa-database";

export const runtimeStatusSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("waiting") }),
  z.object({ state: z.literal("opening") }),
  z.object({ state: z.literal("ready"), openMs: z.number(), migrateMs: z.number() }),
  z.object({ state: z.literal("failed"), reason: z.string() }),
]);
export type RuntimeStatus = z.infer<typeof runtimeStatusSchema>;

export const runtimeRequestSchema = z.object({
  id: z.number().int(),
  operation: z.string(),
  input: z.unknown(),
});
export type RuntimeRequest = z.infer<typeof runtimeRequestSchema>;

export const runtimeMessageSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("status"), status: runtimeStatusSchema }),
  z.object({
    kind: z.literal("result"),
    id: z.number().int(),
    outcome: z.discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), data: z.unknown() }),
      z.object({ ok: z.literal(false), code: z.string() }),
    ]),
  }),
]);
export type RuntimeMessage = z.infer<typeof runtimeMessageSchema>;
