import "server-only";
import { createHash } from "node:crypto";
import type { HealthCheckResult, PublishingProvider } from "@/src/providers/types";
import type { PublishResult } from "@/src/schemas/publish";

/** Deterministic mock publishing provider. Returns an obviously-fake
 *  "public" URL under a reserved example domain — never a URL that could be
 *  mistaken for a real published video. */
export const mockPublishingProvider: PublishingProvider = {
  name: "mock-publishing",
  simulated: true,

  async publish({ title }): Promise<PublishResult> {
    const slug = createHash("sha256").update(title).digest("hex").slice(0, 12);
    return {
      publicUrl: `https://simulation.example.invalid/atlas/${slug}`,
      costUsd: 0,
      simulated: true,
    };
  },

  async checkHealth(): Promise<HealthCheckResult> {
    return { healthy: false, detail: "No publishing vendor configured — using mock publishing" };
  },
};
