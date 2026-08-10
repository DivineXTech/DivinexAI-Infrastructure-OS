import { z } from "zod";

/** Submission payload / job status contract for Stage 4 (Create Audio). */
export const audioJobStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

export const audioJobSchema = z.object({
  jobId: z.string().min(1),
  status: audioJobStatusSchema,
  kind: z.enum(["voiceover", "music"]),
  assetUrl: z.string().url().optional(),
  error: z.string().optional(),
});

export type AudioJobStatus = z.infer<typeof audioJobStatusSchema>;
export type AudioJob = z.infer<typeof audioJobSchema>;
