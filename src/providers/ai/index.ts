import "server-only";
import { getEnv, hasAnthropicCredentials } from "@/src/env";
import { generateStructured } from "@/src/providers/claude";
import { mockIdeaList, mockScriptScenePlan } from "@/src/providers/ai/mock";
import type { AiProvider, HealthCheckResult } from "@/src/providers/types";
import { ideaListSchema, type IdeaList } from "@/src/schemas/idea";
import { scriptScenePlanSchema, type ScriptScenePlan } from "@/src/schemas/script";

const ANTHROPIC_MODELS_URL = "https://api.anthropic.com/v1/models";

/** Reports whether Claude is configured. Uses the (free, non-generative)
 *  models-list endpoint for a real health probe instead of burning tokens
 *  on a completion call every time the status screen loads. */
export const aiProvider: AiProvider = {
  name: hasAnthropicCredentials() ? "anthropic-claude" : "mock-ai",
  simulated: !hasAnthropicCredentials(),

  async checkHealth(): Promise<HealthCheckResult> {
    const env = getEnv();
    if (!env.ANTHROPIC_API_KEY) {
      return { healthy: false, detail: "ANTHROPIC_API_KEY not set — using mock idea/script generation" };
    }
    try {
      const response = await fetch(ANTHROPIC_MODELS_URL, {
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!response.ok) {
        return { healthy: false, detail: `Anthropic API returned HTTP ${response.status}` };
      }
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        detail: error instanceof Error ? error.message : "Unknown Anthropic error",
      };
    }
  },
};

export async function generateIdeaList(input: {
  tenantId: string;
  count?: number;
}): Promise<{ data: IdeaList; simulated: boolean }> {
  if (!hasAnthropicCredentials()) {
    return { data: mockIdeaList(input), simulated: true };
  }

  const generated = await generateStructured({
    schema: ideaListSchema,
    schemaName: "ideaListSchema",
    system:
      "You are the Atlas Ideas Agent. Generate short-form video ideas " +
      "tailored to the tenant's content strategy.",
    prompt: `Generate ${input.count ?? 5} fresh short-form video ideas for tenant ${input.tenantId}.`,
  });

  if (!generated.valid) {
    throw new Error(`Idea generation failed schema validation: ${generated.issues?.join("; ")}`);
  }

  return { data: generated.data!, simulated: false };
}

export async function generateScript(input: {
  ideaId: string;
  title: string;
  hook: string;
  angle: string;
}): Promise<{ data: ScriptScenePlan; simulated: boolean }> {
  if (!hasAnthropicCredentials()) {
    return { data: mockScriptScenePlan(input), simulated: true };
  }

  const generated = await generateStructured({
    schema: scriptScenePlanSchema,
    schemaName: "scriptScenePlanSchema",
    system:
      "You are the Prompt Director Agent. Turn a video idea into a " +
      "scene-by-scene shot list with voiceover lines, on-screen captions, " +
      "per-scene voice direction, and music direction.",
    prompt: `Idea id: ${input.ideaId}\nTitle: ${input.title}\nHook: ${input.hook}\nAngle: ${input.angle}`,
  });

  if (!generated.valid) {
    throw new Error(`Scene plan failed schema validation: ${generated.issues?.join("; ")}`);
  }

  return { data: generated.data!, simulated: false };
}
