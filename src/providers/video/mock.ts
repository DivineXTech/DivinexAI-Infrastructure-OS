import "server-only";
import { randomUUID } from "node:crypto";
import { uploadSimulatedPlaceholder } from "@/src/providers/storage";
import type { HealthCheckResult, VideoProvider } from "@/src/providers/types";
import type { VideoJob } from "@/src/schemas/video-job";

interface JobRecord {
  runId: string;
  sceneOrder: number;
  visualPrompt: string;
  queries: number;
}

const jobs = new Map<string, JobRecord>();

/** Deterministic mock video provider used when VIDEO_PROVIDER=mock (the
 *  default) or when the configured HTTP vendor is unreachable/unset.
 *  Simulates a two-poll async job so the bounded-polling code path is
 *  genuinely exercised, and produces a self-describing JSON placeholder
 *  instead of a fake video file. */
export const mockVideoProvider: VideoProvider = {
  name: "mock-video",
  simulated: true,

  async submitJob({ runId, sceneOrder, visualPrompt }) {
    const jobId = `mock-video-${randomUUID()}`;
    jobs.set(jobId, { runId, sceneOrder, visualPrompt, queries: 0 });
    return { jobId };
  },

  async getJobStatus(jobId): Promise<VideoJob> {
    const job = jobs.get(jobId);
    if (!job) {
      return {
        jobId,
        status: "failed",
        sceneOrder: -1,
        costUsd: 0,
        simulated: true,
        error: `Unknown mock video job id "${jobId}"`,
      };
    }

    job.queries += 1;
    if (job.queries < 2) {
      return {
        jobId,
        status: "processing",
        sceneOrder: job.sceneOrder,
        costUsd: 0,
        simulated: true,
      };
    }

    const { url } = await uploadSimulatedPlaceholder({
      path: `scenes/${job.runId}/${job.sceneOrder}`,
      payload: {
        provider: "mock-video",
        note:
          "Placeholder — no real video was generated. Set VIDEO_PROVIDER=http " +
          "with vendor credentials for real scene rendering.",
        sceneOrder: job.sceneOrder,
        visualPrompt: job.visualPrompt,
      },
    });

    return {
      jobId,
      status: "completed",
      sceneOrder: job.sceneOrder,
      assetUrl: url,
      costUsd: 0,
      simulated: true,
    };
  },

  async checkHealth(): Promise<HealthCheckResult> {
    return { healthy: false, detail: "No video vendor configured — using mock video" };
  },
};
