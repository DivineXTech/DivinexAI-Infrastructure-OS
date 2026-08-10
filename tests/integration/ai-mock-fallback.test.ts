import { describe, expect, it } from "vitest";
import { generateIdeaList, generateScript } from "@/src/providers/ai";
import { ideaListSchema } from "@/src/schemas/idea";
import { scriptScenePlanSchema } from "@/src/schemas/script";

// ANTHROPIC_API_KEY is intentionally unset in the test environment, so these
// exercise the deterministic mock fallback path — the same path a real
// deployment falls back to when Claude isn't configured.

describe("generateIdeaList (mock fallback)", () => {
  it("returns schema-valid, clearly-simulated ideas without any credentials", async () => {
    const result = await generateIdeaList({ tenantId: "tenant-1", count: 3 });
    expect(result.simulated).toBe(true);
    expect(ideaListSchema.safeParse(result.data).success).toBe(true);
    expect(result.data.ideas.every((idea) => idea.title.includes("[SIMULATED]"))).toBe(true);
  });
});

describe("generateScript (mock fallback)", () => {
  it("returns a schema-valid, clearly-simulated scene plan", async () => {
    const result = await generateScript({
      ideaId: "123e4567-e89b-12d3-a456-426614174000",
      title: "A great idea",
      hook: "You won't believe this",
      angle: "Explain the surprising truth",
    });

    expect(result.simulated).toBe(true);
    expect(scriptScenePlanSchema.safeParse(result.data).success).toBe(true);
    expect(result.data.scenes.length).toBeGreaterThan(0);
    expect(
      result.data.totalDurationSeconds,
    ).toBeCloseTo(
      result.data.scenes.reduce((sum, s) => sum + s.durationSeconds, 0),
      5,
    );
  });
});
