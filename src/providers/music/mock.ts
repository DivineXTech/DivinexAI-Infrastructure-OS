import "server-only";
import { randomUUID } from "node:crypto";
import { uploadSimulatedPlaceholder } from "@/src/providers/storage";
import type { HealthCheckResult, MusicProvider } from "@/src/providers/types";
import type { AudioJob } from "@/src/schemas/audio-job";

interface JobRecord {
  runId: string;
  mood: string;
  direction: string;
  queries: number;
}

const jobs = new Map<string, JobRecord>();

/** Deterministic mock music provider used when no music vendor is
 *  configured. Produces a self-describing JSON placeholder, never a fake
 *  audio file passed off as licensed music. */
export const mockMusicProvider: MusicProvider = {
  name: "mock-music",
  simulated: true,

  async submitMusicJob({ runId, mood, direction }) {
    const jobId = `mock-music-${randomUUID()}`;
    jobs.set(jobId, { runId, mood, direction, queries: 0 });
    return { jobId };
  },

  async getJobStatus(jobId): Promise<AudioJob> {
    const job = jobs.get(jobId);
    if (!job) {
      return {
        jobId,
        status: "failed",
        kind: "music",
        costUsd: 0,
        simulated: true,
        error: `Unknown mock music job id "${jobId}"`,
      };
    }

    job.queries += 1;
    if (job.queries < 2) {
      return { jobId, status: "processing", kind: "music", costUsd: 0, simulated: true };
    }

    const { url } = await uploadSimulatedPlaceholder({
      path: `music/${job.runId}/${jobId}`,
      payload: {
        provider: "mock-music",
        note:
          "Placeholder — no real music was generated or licensed. Configure " +
          "MUSIC_PROVIDER=http with vendor credentials for real output.",
        mood: job.mood,
        direction: job.direction,
      },
    });

    return {
      jobId,
      status: "completed",
      kind: "music",
      assetUrl: url,
      costUsd: 0,
      simulated: true,
    };
  },

  async checkHealth(): Promise<HealthCheckResult> {
    return { healthy: false, detail: "No music vendor configured — using mock music" };
  },
};
