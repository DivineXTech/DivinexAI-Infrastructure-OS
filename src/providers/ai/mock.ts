import type { IdeaList } from "@/src/schemas/idea";
import type { ScriptScenePlan } from "@/src/schemas/script";

/**
 * Deterministic fallback idea generator used when ANTHROPIC_API_KEY is not
 * set. Templated, not random, so runs stay reproducible — and every idea
 * title is prefixed "[SIMULATED]" so it can never be mistaken for a real
 * Claude-generated idea downstream.
 */
export function mockIdeaList(input: { tenantId: string; count?: number }): IdeaList {
  const count = Math.min(Math.max(input.count ?? 3, 1), 5);
  const topics = [
    "a common misconception in your industry",
    "a before/after transformation",
    "a behind-the-scenes look at how it's made",
    "a myth vs. fact breakdown",
    "a 3-step quick win viewers can try today",
  ];

  return {
    ideas: Array.from({ length: count }, (_, index) => ({
      title: `[SIMULATED] Idea ${index + 1} for tenant ${input.tenantId}`,
      hook: `[SIMULATED] Did you know this about ${topics[index % topics.length]}?`,
      targetAudience: "[SIMULATED] General short-form video audience",
      angle: `[SIMULATED] Explain ${topics[index % topics.length]} in under 60 seconds with a strong visual hook.`,
      tags: ["simulated", "mock-ai"],
    })),
  };
}

/**
 * Deterministic fallback scene-plan generator. Produces a schema-valid
 * three-scene plan derived from the idea's own text so the rest of the
 * pipeline (video/audio/assembly) has something real to operate on, while
 * every field is clearly marked as simulated.
 */
export function mockScriptScenePlan(input: {
  ideaId: string;
  title: string;
  hook: string;
  angle: string;
}): ScriptScenePlan {
  const scenes = [
    {
      order: 0,
      durationSeconds: 5,
      visualPrompt: `[SIMULATED] Opening shot establishing the hook: ${input.hook}`,
      voiceoverLine: input.hook,
      captionText: input.hook.slice(0, 80),
      voiceDirection: "[SIMULATED] Energetic, fast-paced delivery",
      musicDirection: "[SIMULATED] Upbeat sting on the hook",
    },
    {
      order: 1,
      durationSeconds: 15,
      visualPrompt: `[SIMULATED] Supporting visuals for the angle: ${input.angle}`,
      voiceoverLine: `[SIMULATED] Here's what's really going on: ${input.angle}`,
      captionText: "[SIMULATED] The real story",
      voiceDirection: "[SIMULATED] Clear, explanatory tone",
      musicDirection: "[SIMULATED] Understated bed, low energy",
    },
    {
      order: 2,
      durationSeconds: 5,
      visualPrompt: "[SIMULATED] Closing call-to-action shot with on-screen text",
      voiceoverLine: "[SIMULATED] Follow for more like this.",
      captionText: "[SIMULATED] Follow for more",
      voiceDirection: "[SIMULATED] Warm, inviting close",
      musicDirection: "[SIMULATED] Swell and resolve",
    },
  ];

  return {
    ideaId: input.ideaId,
    title: `[SIMULATED] ${input.title}`,
    totalDurationSeconds: scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    scenes,
    musicMood: "[SIMULATED] upbeat-explainer",
    musicDirection: "[SIMULATED] Light corporate-pop bed matching an upbeat explainer mood",
  };
}
