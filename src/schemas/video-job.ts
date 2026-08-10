import { z } from "zod";

/** Submission payload / job status contract for Stage 3 (Generate Video). */
export const videoJobStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const videoJobSchema = z.object({
  jobId: z.string().min(1),
  status: videoJobStatusSchema,
  sceneOrder: z.number().int().nonnegative(),
  assetUrl: z.string().url().optional(),
  costUsd: z.number().nonnegative().default(0),
  simulated: z.boolean().default(false),
  error: z.string().optional(),
});

export type VideoJobStatus = z.infer<typeof videoJobStatusSchema>;
export type VideoJob = z.infer<typeof videoJobSchema>;
