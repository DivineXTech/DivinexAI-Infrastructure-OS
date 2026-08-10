import { z } from "zod";

/** Inbound payload contract for provider job-completion webhooks
 *  (video/music). A vendor integrated behind the generic HTTP adapter
 *  (src/providers/http/client.ts) is expected to POST this shape, signed
 *  per src/lib/webhook-signature.ts. */
export const providerWebhookPayloadSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  assetUrl: z.string().url().optional(),
  costUsd: z.number().nonnegative().optional(),
  error: z.string().optional(),
});

export type ProviderWebhookPayload = z.infer<typeof providerWebhookPayloadSchema>;
