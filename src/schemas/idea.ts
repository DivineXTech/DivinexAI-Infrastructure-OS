import { z } from "zod";

/** Structured output contract for the Atlas Ideas Agent (Stage 1). */
export const ideaSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(4).max(120),
  hook: z.string().min(10).max(280),
  targetAudience: z.string().min(3).max(160),
  angle: z.string().min(10).max(500),
  tags: z.array(z.string().min(1)).max(10).default([]),
});

export const ideaListSchema = z.object({
  ideas: z.array(ideaSchema).min(1).max(20),
});

export type Idea = z.infer<typeof ideaSchema>;
export type IdeaList = z.infer<typeof ideaListSchema>;
