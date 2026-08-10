import "server-only";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/src/env";
import { storageProvider } from "@/src/providers/storage";
import type { HealthCheckResult, VoiceProvider } from "@/src/providers/types";
import type { AudioJob } from "@/src/schemas/audio-job";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";

/** Approximate ElevenLabs Multilingual v2 cost per 1,000 characters (USD).
 *  This is an estimate for cost tracking/reporting, not a billing source of
 *  truth — check your ElevenLabs plan for exact rates. */
const COST_PER_1K_CHARS_USD = 0.3;

const completedJobs = new Map<string, AudioJob>();

/** Real ElevenLabs narration provider (Multilingual v2). ElevenLabs' TTS
 *  endpoint is synchronous, so submitVoiceoverJob() performs the full
 *  synthesis + upload and getJobStatus() just replays the recorded result —
 *  this keeps the interface consistent with providers that are genuinely
 *  async without pretending ElevenLabs needs polling. */
export const elevenLabsVoiceProvider: VoiceProvider = {
  name: "elevenlabs",
  simulated: false,

  async submitVoiceoverJob({ runId, sceneId, text, voiceId }) {
    const env = getEnv();
    if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
      throw new Error("ElevenLabs is not configured (missing API key or voice id)");
    }

    const resolvedVoiceId = voiceId ?? env.ELEVENLABS_VOICE_ID;
    const jobId = `elevenlabs-${randomUUID()}`;

    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: env.ELEVENLABS_MODEL_ID,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      completedJobs.set(jobId, {
        jobId,
        status: "failed",
        kind: "voiceover",
        costUsd: 0,
        simulated: false,
        error: `ElevenLabs TTS request failed (${response.status}): ${detail}`,
      });
      return { jobId };
    }

    const audio = new Uint8Array(await response.arrayBuffer());
    const { url } = await storageProvider.upload({
      path: `narration/${runId}/${sceneId}.mp3`,
      data: audio,
      contentType: "audio/mpeg",
    });

    completedJobs.set(jobId, {
      jobId,
      status: "completed",
      kind: "voiceover",
      assetUrl: url,
      costUsd: Number(((text.length / 1000) * COST_PER_1K_CHARS_USD).toFixed(4)),
      simulated: false,
    });

    return { jobId };
  },

  async getJobStatus(jobId) {
    const job = completedJobs.get(jobId);
    if (!job) {
      return {
        jobId,
        status: "failed",
        kind: "voiceover",
        costUsd: 0,
        simulated: false,
        error: `Unknown ElevenLabs job id "${jobId}"`,
      };
    }
    return job;
  },

  async checkHealth(): Promise<HealthCheckResult> {
    try {
      const env = getEnv();
      if (!env.ELEVENLABS_API_KEY) {
        return { healthy: false, detail: "ELEVENLABS_API_KEY not set" };
      }
      const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/user`, {
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
      });
      if (!response.ok) {
        return { healthy: false, detail: `ElevenLabs returned HTTP ${response.status}` };
      }
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        detail: error instanceof Error ? error.message : "Unknown ElevenLabs error",
      };
    }
  },
};
