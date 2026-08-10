import { describe, expect, it } from "vitest";
import { generateIdeaList, generateScript } from "@/src/providers/ai";
import { mockVideoProvider } from "@/src/providers/video/mock";
import { mockVoiceProvider } from "@/src/providers/voice/mock";
import { mockMusicProvider } from "@/src/providers/music/mock";
import { mockPublishingProvider } from "@/src/providers/publishing/mock";
import { composeVideo } from "@/src/composition/render";

/**
 * Domain-level, end-to-end walk through every pipeline stage using the
 * mock provider chain — the same providers the Inngest functions in
 * src/workflow/inngest/functions.ts call, wired together here directly
 * rather than through Inngest's durable execution. Driving the actual
 * Inngest functions end-to-end would require a live Inngest dev server and
 * a real Postgres/Supabase instance, neither of which is available in this
 * environment; this test instead proves the same provider chain those
 * functions orchestrate genuinely produces a coherent, correctly-labeled
 * result when run start to finish with zero credentials configured.
 */
describe("full pipeline (mock providers, zero credentials)", () => {
  it("goes from idea generation to a published (simulated) video", async () => {
    // Stage 1 — Idea Generation
    const ideaResult = await generateIdeaList({ tenantId: "tenant-1", count: 1 });
    expect(ideaResult.simulated).toBe(true);
    const idea = ideaResult.data.ideas[0]!;

    // Stage 2 — Video Prompts
    const scriptResult = await generateScript({
      ideaId: "123e4567-e89b-12d3-a456-426614174000",
      title: idea.title,
      hook: idea.hook,
      angle: idea.angle,
    });
    expect(scriptResult.simulated).toBe(true);
    const plan = scriptResult.data;

    // Stage 3 — Generate Video (per scene)
    const sceneAssets = [];
    for (const scene of plan.scenes) {
      const { jobId } = await mockVideoProvider.submitJob({
        runId: "run-full-pipeline",
        sceneOrder: scene.order,
        visualPrompt: scene.visualPrompt,
        durationSeconds: scene.durationSeconds,
      });
      await mockVideoProvider.getJobStatus(jobId); // processing
      const video = await mockVideoProvider.getJobStatus(jobId); // completed
      expect(video.status).toBe("completed");

      // Stage 4 — narration for this scene
      const { jobId: voiceJobId } = await mockVoiceProvider.submitVoiceoverJob({
        runId: "run-full-pipeline",
        sceneId: `scene-${scene.order}`,
        text: scene.voiceoverLine,
      });
      await mockVoiceProvider.getJobStatus(voiceJobId); // processing
      const narration = await mockVoiceProvider.getJobStatus(voiceJobId); // completed
      expect(narration.status).toBe("completed");

      sceneAssets.push({
        order: scene.order,
        durationSeconds: scene.durationSeconds,
        videoUrl: video.assetUrl!,
        narrationUrl: narration.assetUrl,
        captionText: scene.captionText,
      });
    }

    // Stage 4 — music for the whole run
    const { jobId: musicJobId } = await mockMusicProvider.submitMusicJob({
      runId: "run-full-pipeline",
      mood: plan.musicMood,
      direction: plan.musicDirection,
      durationSeconds: plan.totalDurationSeconds,
    });
    await mockMusicProvider.getJobStatus(musicJobId); // processing
    const music = await mockMusicProvider.getJobStatus(musicJobId); // completed
    expect(music.status).toBe("completed");

    // Stage 5 — Assemble
    const composition = await composeVideo({
      runId: "run-full-pipeline",
      title: plan.title,
      brandName: "Atlas",
      scenes: sceneAssets,
      musicUrl: music.assetUrl,
      simulated: true, // every upstream asset above is a mock placeholder
    });
    expect(composition.simulated).toBe(true);
    expect(composition.durationSeconds).toBeCloseTo(plan.totalDurationSeconds, 5);

    // Stage 5 — Publish
    const published = await mockPublishingProvider.publish({
      videoUrl: composition.url ?? composition.outputPath,
      title: plan.title,
      description: "Full pipeline test run",
    });
    expect(published.simulated).toBe(true);
    expect(published.publicUrl).toMatch(/^https:\/\/simulation\./);

    // The whole run should be traceable end to end and honestly labeled as
    // simulated at every step — never presented as real output.
    expect([
      ideaResult.simulated,
      scriptResult.simulated,
      composition.simulated,
      published.simulated,
    ]).toEqual([true, true, true, true]);
  });
});
