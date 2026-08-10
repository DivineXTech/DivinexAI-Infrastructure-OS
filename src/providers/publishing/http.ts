import "server-only";
import { getEnv } from "@/src/env";
import { httpProviderHealthCheck, httpProviderRequest } from "@/src/providers/http/client";
import type { HealthCheckResult, PublishingProvider } from "@/src/providers/types";
import { publishResultSchema } from "@/src/schemas/publish";

/** Generic vendor-neutral HTTP publishing provider (YouTube, TikTok, etc.
 *  behind a thin proxy speaking this contract). */
export const httpPublishingProvider: PublishingProvider = {
  name: "http-publishing",
  simulated: false,

  async publish({ videoUrl, title, description }) {
    const env = getEnv();
    if (!env.PUBLISHING_PROVIDER_BASE_URL || !env.PUBLISHING_PROVIDER_API_KEY) {
      throw new Error("Publishing provider is not configured (missing base URL or API key)");
    }
    const result = await httpProviderRequest<unknown>({
      baseUrl: env.PUBLISHING_PROVIDER_BASE_URL,
      apiKey: env.PUBLISHING_PROVIDER_API_KEY,
      path: "/publish",
      method: "POST",
      body: { videoUrl, title, description },
    });

    const parsed = publishResultSchema.safeParse(result);
    if (!parsed.success) {
      throw new Error(
        `Publishing provider returned an invalid response: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
    }
    return { ...parsed.data, simulated: false };
  },

  async checkHealth(): Promise<HealthCheckResult> {
    const env = getEnv();
    if (!env.PUBLISHING_PROVIDER_BASE_URL || !env.PUBLISHING_PROVIDER_API_KEY) {
      return { healthy: false, detail: "Publishing provider base URL or API key not set" };
    }
    return httpProviderHealthCheck({
      baseUrl: env.PUBLISHING_PROVIDER_BASE_URL,
      apiKey: env.PUBLISHING_PROVIDER_API_KEY,
    });
  },
};
