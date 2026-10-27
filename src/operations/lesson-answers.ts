import { z } from "zod";

export const MAX_ANSWERS = 12;
export const answerSchema = z.union([
  z.null(),
  z.number().int().min(0).max(50),
  z.array(z.number().int().min(0).max(50)).max(30),
  z.string().max(400),
]);
