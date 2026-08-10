import { z } from "zod";

/** A single beat in the scene plan produced by the Prompt Director Agent (Stage 2). */
export const sceneSchema = z.object({
  order: z.number().int().nonnegative(),
  durationSeconds: z.number().positive().max(60),
  visualPrompt: z.string().min(10).max(1000),
  voiceoverLine: z.string().min(1).max(500),
  onScreenText: z.string().max(200).optional(),
});

export const scriptScenePlanSchema = z.object({
  ideaId: z.string().uuid(),
  title: z.string().min(4).max(120),
  totalDurationSeconds: z.number().positive().max(600),
  scenes: z.array(sceneSchema).min(1).max(50),
  musicMood: z.string().min(2).max(120),
});

export type Scene = z.infer<typeof sceneSchema>;
export type ScriptScenePlan = z.infer<typeof scriptScenePlanSchema>;
