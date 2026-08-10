import { describe, expect, it } from "vitest";
import { mockVideoProvider } from "@/src/providers/video/mock";
import { mockVoiceProvider } from "@/src/providers/voice/mock";
import { mockMusicProvider } from "@/src/providers/music/mock";
import { mockPublishingProvider } from "@/src/providers/publishing/mock";

describe("mockVideoProvider", () => {
  it("simulates a two-poll async job and produces a labeled placeholder artifact", async () => {
    const { jobId } = await mockVideoProvider.submitJob({
      runId: "run-1",
      sceneOrder: 0,
      visualPrompt: "A test scene",
      durationSeconds: 5,
    });

    const first = await mockVideoProvider.getJobStatus(jobId);
    expect(first.status).toBe("processing");
    expect(first.simulated).toBe(true);

    const second = await mockVideoProvider.getJobStatus(jobId);
    expect(second.status).toBe("completed");
    expect(second.simulated).toBe(true);
    expect(second.assetUrl).toBeDefined();
    expect(second.costUsd).toBe(0);
  });

  it("reports failed status for an unknown job id", async () => {
    const status = await mockVideoProvider.getJobStatus("does-not-exist");
    expect(status.status).toBe("failed");
    expect(status.error).toBeDefined();
  });

  it("checkHealth always reports unhealthy/simulated", async () => {
    const health = await mockVideoProvider.checkHealth();
    expect(health.healthy).toBe(false);
  });
});

describe("mockVoiceProvider", () => {
  it("simulates narration synthesis and produces an artifact", async () => {
    const { jobId } = await mockVoiceProvider.submitVoiceoverJob({
      runId: "run-1",
      sceneId: "scene-1",
      text: "Hello world",
    });

    await mockVoiceProvider.getJobStatus(jobId); // processing
    const completed = await mockVoiceProvider.getJobStatus(jobId);
    expect(completed.status).toBe("completed");
    expect(completed.kind).toBe("voiceover");
    expect(completed.simulated).toBe(true);
  });
});

describe("mockMusicProvider", () => {
  it("simulates music generation and produces an artifact", async () => {
    const { jobId } = await mockMusicProvider.submitMusicJob({
      runId: "run-1",
      mood: "calm",
      direction: "ambient",
      durationSeconds: 30,
    });

    await mockMusicProvider.getJobStatus(jobId); // processing
    const completed = await mockMusicProvider.getJobStatus(jobId);
    expect(completed.status).toBe("completed");
    expect(completed.kind).toBe("music");
    expect(completed.simulated).toBe(true);
  });
});

describe("mockPublishingProvider", () => {
  it("returns an obviously-simulated public URL", async () => {
    const result = await mockPublishingProvider.publish({
      videoUrl: "file:///tmp/final.json",
      title: "Test Video",
      description: "A test",
    });

    expect(result.simulated).toBe(true);
    expect(result.costUsd).toBe(0);
    expect(new URL(result.publicUrl).hostname).toContain("invalid");
  });

  it("is deterministic for the same title", async () => {
    const a = await mockPublishingProvider.publish({
      videoUrl: "x",
      title: "Same Title",
      description: "",
    });
    const b = await mockPublishingProvider.publish({
      videoUrl: "y",
      title: "Same Title",
      description: "",
    });
    expect(a.publicUrl).toBe(b.publicUrl);
  });
});
