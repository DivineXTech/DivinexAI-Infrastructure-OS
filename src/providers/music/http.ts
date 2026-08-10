import "server-only";
import { getEnv } from "@/src/env";
import { httpProviderHealthCheck, httpProviderRequest } from "@/src/providers/http/client";
import type { HealthCheckResult, MusicProvider } from "@/src/providers/types";
import type { AudioJob } from "@/src/schemas/audio-job";

/** Generic vendor-neutral HTTP music provider (licensed background music). */
export const httpMusicProvider: MusicProvider = {
  name: "http-music",
  simulated: false,

  async submitMusicJob({ runId, mood, direction, durationSeconds }) {
    const env = getEnv();
    if (!env.MUSIC_PROVIDER_BASE_URL || !env.MUSIC_PROVIDER_API_KEY) {
      throw new Error("Music provider is not configured (missing base URL or API key)");
    }
    return httpProviderRequest<{ jobId: string }>({
      baseUrl: env.MUSIC_PROVIDER_BASE_URL,
      apiKey: env.MUSIC_PROVIDER_API_KEY,
      path: "/jobs",
      method: "POST",
      body: { runId, mood, direction, durationSeconds },
    });
  },

  async getJobStatus(jobId): Promise<AudioJob> {
    const env = getEnv();
    if (!env.MUSIC_PROVIDER_BASE_URL || !env.MUSIC_PROVIDER_API_KEY) {
      throw new Error("Music provider is not configured (missing base URL or API key)");
    }
    const result = await httpProviderRequest<{
      status: AudioJob["status"];
      assetUrl?: string;
      costUsd?: number;
      error?: string;
    }>({
      baseUrl: env.MUSIC_PROVIDER_BASE_URL,
      apiKey: env.MUSIC_PROVIDER_API_KEY,
      path: `/jobs/${jobId}`,
    });

    return {
      jobId,
      status: result.status,
      kind: "music",
      assetUrl: result.assetUrl,
      costUsd: result.costUsd ?? 0,
      simulated: false,
      error: result.error,
    };
  },

  async checkHealth(): Promise<HealthCheckResult> {
    const env = getEnv();
    if (!env.MUSIC_PROVIDER_BASE_URL || !env.MUSIC_PROVIDER_API_KEY) {
      return { healthy: false, detail: "Music provider base URL or API key not set" };
    }
    return httpProviderHealthCheck({
      baseUrl: env.MUSIC_PROVIDER_BASE_URL,
      apiKey: env.MUSIC_PROVIDER_API_KEY,
    });
  },
};
