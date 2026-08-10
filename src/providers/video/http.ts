import "server-only";
import { getEnv } from "@/src/env";
import { httpProviderHealthCheck, httpProviderRequest } from "@/src/providers/http/client";
import type { HealthCheckResult, VideoProvider } from "@/src/providers/types";
import type { VideoJob } from "@/src/schemas/video-job";

/** Generic vendor-neutral HTTP video provider. Point VIDEO_PROVIDER_BASE_URL
 *  at any vendor (or a thin proxy in front of one) that speaks the
 *  submit-job/get-status/webhook contract documented in
 *  src/providers/http/client.ts. */
export const httpVideoProvider: VideoProvider = {
  name: "http-video",
  simulated: false,

  async submitJob({ runId, sceneOrder, visualPrompt, durationSeconds }) {
    const env = getEnv();
    if (!env.VIDEO_PROVIDER_BASE_URL || !env.VIDEO_PROVIDER_API_KEY) {
      throw new Error("Video provider is not configured (missing base URL or API key)");
    }
    return httpProviderRequest<{ jobId: string }>({
      baseUrl: env.VIDEO_PROVIDER_BASE_URL,
      apiKey: env.VIDEO_PROVIDER_API_KEY,
      path: "/jobs",
      method: "POST",
      body: { runId, sceneOrder, prompt: visualPrompt, durationSeconds },
    });
  },

  async getJobStatus(jobId): Promise<VideoJob> {
    const env = getEnv();
    if (!env.VIDEO_PROVIDER_BASE_URL || !env.VIDEO_PROVIDER_API_KEY) {
      throw new Error("Video provider is not configured (missing base URL or API key)");
    }
    const result = await httpProviderRequest<{
      status: VideoJob["status"];
      sceneOrder?: number;
      assetUrl?: string;
      costUsd?: number;
      error?: string;
    }>({
      baseUrl: env.VIDEO_PROVIDER_BASE_URL,
      apiKey: env.VIDEO_PROVIDER_API_KEY,
      path: `/jobs/${jobId}`,
    });

    return {
      jobId,
      status: result.status,
      sceneOrder: result.sceneOrder ?? -1,
      assetUrl: result.assetUrl,
      costUsd: result.costUsd ?? 0,
      simulated: false,
      error: result.error,
    };
  },

  async checkHealth(): Promise<HealthCheckResult> {
    const env = getEnv();
    if (!env.VIDEO_PROVIDER_BASE_URL || !env.VIDEO_PROVIDER_API_KEY) {
      return { healthy: false, detail: "Video provider base URL or API key not set" };
    }
    return httpProviderHealthCheck({
      baseUrl: env.VIDEO_PROVIDER_BASE_URL,
      apiKey: env.VIDEO_PROVIDER_API_KEY,
    });
  },
};
