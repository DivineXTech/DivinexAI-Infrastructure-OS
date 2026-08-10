import "server-only";
import { randomUUID } from "node:crypto";
import { uploadSimulatedPlaceholder } from "@/src/providers/storage";
import type { HealthCheckResult, VoiceProvider } from "@/src/providers/types";
import type { AudioJob } from "@/src/schemas/audio-job";

interface JobRecord {
  runId: string;
  sceneId: string;
  text: string;
  queries: number;
}

const jobs = new Map<string, JobRecord>();

/** Deterministic mock narration provider used when ElevenLabs is not
 *  configured. Produces a self-describing JSON placeholder instead of a
 *  fake audio file — see uploadSimulatedPlaceholder(). */
export const mockVoiceProvider: VoiceProvider = {
  name: "mock-voice",
  simulated: true,

  async submitVoiceoverJob({ runId, sceneId, text }) {
    const jobId = `mock-voice-${randomUUID()}`;
    jobs.set(jobId, { runId, sceneId, text, queries: 0 });
    return { jobId };
  },

  async getJobStatus(jobId): Promise<AudioJob> {
    const job = jobs.get(jobId);
    if (!job) {
      return {
        jobId,
        status: "failed",
        kind: "voiceover",
        costUsd: 0,
        simulated: true,
        error: `Unknown mock voice job id "${jobId}"`,
      };
    }

    job.queries += 1;
    if (job.queries < 2) {
      return { jobId, status: "processing", kind: "voiceover", costUsd: 0, simulated: true };
    }

    const { url } = await uploadSimulatedPlaceholder({
      path: `narration/${job.runId}/${job.sceneId}`,
      payload: {
        provider: "mock-voice",
        note:
          "Placeholder — no real narration was synthesized. Configure " +
          "ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID for real narration.",
        text: job.text,
      },
    });

    return {
      jobId,
      status: "completed",
      kind: "voiceover",
      assetUrl: url,
      costUsd: 0,
      simulated: true,
    };
  },

  async checkHealth(): Promise<HealthCheckResult> {
    return { healthy: false, detail: "ElevenLabs is not configured — using mock narration" };
  },
};
