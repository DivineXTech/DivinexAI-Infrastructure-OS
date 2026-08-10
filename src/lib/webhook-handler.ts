import "server-only";
import { NextResponse } from "next/server";
import { inngest, videoJobWebhook, musicJobWebhook } from "@/src/workflow/inngest/client";
import { verifyWebhookSignature } from "@/src/lib/webhook-signature";
import { providerWebhookPayloadSchema } from "@/src/schemas/webhook";

/**
 * Shared handler for inbound video/music provider job-completion webhooks.
 * Verifies the HMAC signature before touching the body, validates the
 * payload shape, then forwards a durable event that the corresponding
 * Inngest function's `step.waitForEvent` is listening for — see
 * src/workflow/inngest/functions.ts.
 */
export async function handleProviderWebhook(
  request: Request,
  options: { secret: string | undefined; capability: "video" | "music" },
): Promise<Response> {
  const rawBody = await request.text();

  if (!options.secret) {
    return NextResponse.json(
      { error: "Webhook secret is not configured for this provider" },
      { status: 503 },
    );
  }

  const signatureHeader = request.headers.get("x-atlas-signature");
  const valid = verifyWebhookSignature({
    payload: rawBody,
    signatureHeader,
    secret: options.secret,
  });

  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const parsed = providerWebhookPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid webhook payload", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const event =
    options.capability === "video"
      ? videoJobWebhook.create(parsed.data)
      : musicJobWebhook.create(parsed.data);

  await inngest.send(event);

  return NextResponse.json({ received: true });
}
