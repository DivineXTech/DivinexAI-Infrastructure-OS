import { getEnv } from "@/src/env";
import { handleProviderWebhook } from "@/src/lib/webhook-handler";

export async function POST(request: Request): Promise<Response> {
  return handleProviderWebhook(request, {
    secret: getEnv().VIDEO_WEBHOOK_SECRET,
    capability: "video",
  });
}
