import { z } from "zod";

/** Result contract for Stage 5's Publish step. */
export const publishResultSchema = z.object({
  publicUrl: z.string().url(),
  costUsd: z.number().nonnegative().default(0),
  simulated: z.boolean().default(false),
});

export type PublishResult = z.infer<typeof publishResultSchema>;
