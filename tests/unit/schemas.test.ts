import { describe, expect, it } from "vitest";
import { ideaListSchema } from "@/src/schemas/idea";
import { scriptScenePlanSchema } from "@/src/schemas/script";
import { videoJobSchema } from "@/src/schemas/video-job";
import { audioJobSchema } from "@/src/schemas/audio-job";
import { publishResultSchema } from "@/src/schemas/publish";
import { providerWebhookPayloadSchema } from "@/src/schemas/webhook";
import { mockIdeaList, mockScriptScenePlan } from "@/src/providers/ai/mock";

describe("ideaListSchema", () => {
  it("accepts the deterministic mock idea generator's output", () => {
    const ideas = mockIdeaList({ tenantId: "tenant-1", count: 3 });
    expect(ideaListSchema.safeParse(ideas).success).toBe(true);
  });

  it("rejects an empty idea list", () => {
    expect(ideaListSchema.safeParse({ ideas: [] }).success).toBe(false);
  });

  it("rejects an idea missing required fields", () => {
    expect(
      ideaListSchema.safeParse({ ideas: [{ title: "Too short fields" }] }).success,
    ).toBe(false);
  });
});

describe("scriptScenePlanSchema", () => {
  it("accepts the deterministic mock script generator's output", () => {
    const plan = mockScriptScenePlan({
      ideaId: "123e4567-e89b-12d3-a456-426614174000",
      title: "Test idea",
      hook: "A hook",
      angle: "An angle",
    });
    expect(scriptScenePlanSchema.safeParse(plan).success).toBe(true);
  });

  it("rejects a plan with zero scenes", () => {
    expect(
      scriptScenePlanSchema.safeParse({
        ideaId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Test",
        totalDurationSeconds: 10,
        scenes: [],
        musicMood: "calm",
        musicDirection: "soft",
      }).success,
    ).toBe(false);
  });

  it("rejects a scene longer than 60 seconds", () => {
    expect(
      scriptScenePlanSchema.safeParse({
        ideaId: "123e4567-e89b-12d3-a456-426614174000",
        title: "Test",
        totalDurationSeconds: 90,
        musicMood: "calm",
        musicDirection: "soft",
        scenes: [
          {
            order: 0,
            durationSeconds: 90,
            visualPrompt: "A visual prompt long enough",
            voiceoverLine: "line",
            captionText: "caption",
            voiceDirection: "direction",
            musicDirection: "direction",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("videoJobSchema", () => {
  it("defaults costUsd and simulated when omitted", () => {
    const parsed = videoJobSchema.parse({
      jobId: "job-1",
      status: "completed",
      sceneOrder: 0,
    });
    expect(parsed.costUsd).toBe(0);
    expect(parsed.simulated).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(
      videoJobSchema.safeParse({ jobId: "job-1", status: "done", sceneOrder: 0 }).success,
    ).toBe(false);
  });
});

describe("audioJobSchema", () => {
  it("requires a valid kind", () => {
    expect(
      audioJobSchema.safeParse({ jobId: "job-1", status: "completed", kind: "sfx" }).success,
    ).toBe(false);
  });

  it("accepts a valid voiceover job", () => {
    expect(
      audioJobSchema.safeParse({ jobId: "job-1", status: "completed", kind: "voiceover" })
        .success,
    ).toBe(true);
  });
});

describe("publishResultSchema", () => {
  it("requires a valid URL", () => {
    expect(publishResultSchema.safeParse({ publicUrl: "not-a-url" }).success).toBe(false);
    expect(
      publishResultSchema.safeParse({ publicUrl: "https://example.invalid/x" }).success,
    ).toBe(true);
  });
});

describe("providerWebhookPayloadSchema", () => {
  it("accepts a minimal valid completion payload", () => {
    expect(
      providerWebhookPayloadSchema.safeParse({ jobId: "job-1", status: "completed" }).success,
    ).toBe(true);
  });

  it("rejects a payload without a jobId", () => {
    expect(providerWebhookPayloadSchema.safeParse({ status: "completed" }).success).toBe(
      false,
    );
  });

  it("rejects an invalid assetUrl", () => {
    expect(
      providerWebhookPayloadSchema.safeParse({
        jobId: "job-1",
        status: "completed",
        assetUrl: "not-a-url",
      }).success,
    ).toBe(false);
  });
});
