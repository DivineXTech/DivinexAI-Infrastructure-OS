import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleProviderWebhook } from "@/src/lib/webhook-handler";
import { signWebhookPayload } from "@/src/lib/webhook-signature";
import { inngest } from "@/src/workflow/inngest/client";

const SECRET = "video-webhook-secret";

function makeRequest(body: string, signature: string | null): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("x-atlas-signature", signature);
  return new Request("https://app.example.com/api/webhooks/video", {
    method: "POST",
    headers,
    body,
  });
}

describe("handleProviderWebhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 503 when no secret is configured", async () => {
    const response = await handleProviderWebhook(makeRequest("{}", null), {
      secret: undefined,
      capability: "video",
    });
    expect(response.status).toBe(503);
  });

  it("returns 401 for a missing/invalid signature", async () => {
    const body = JSON.stringify({ jobId: "job-1", status: "completed" });
    const response = await handleProviderWebhook(makeRequest(body, "deadbeef"), {
      secret: SECRET,
      capability: "video",
    });
    expect(response.status).toBe(401);
  });

  it("returns 422 for a validly-signed but schema-invalid payload", async () => {
    const body = JSON.stringify({ status: "completed" }); // missing jobId
    const signature = signWebhookPayload(body, SECRET);
    const response = await handleProviderWebhook(makeRequest(body, signature), {
      secret: SECRET,
      capability: "video",
    });
    expect(response.status).toBe(422);
  });

  it("forwards a valid, correctly-signed payload as an Inngest event and returns 200", async () => {
    const sendSpy = vi.spyOn(inngest, "send").mockResolvedValue({ ids: ["evt-1"] } as never);

    const body = JSON.stringify({
      jobId: "job-1",
      status: "completed",
      assetUrl: "https://cdn.example.com/video.mp4",
    });
    const signature = signWebhookPayload(body, SECRET);

    const response = await handleProviderWebhook(makeRequest(body, signature), {
      secret: SECRET,
      capability: "video",
    });

    expect(response.status).toBe(200);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const sentEvent = sendSpy.mock.calls[0]![0] as { name: string; data: Record<string, unknown> };
    expect(sentEvent.name).toBe("atlas/video-job.webhook");
    expect(sentEvent.data.jobId).toBe("job-1");
  });

  it("routes music webhooks to the music event name", async () => {
    const sendSpy = vi.spyOn(inngest, "send").mockResolvedValue({ ids: ["evt-2"] } as never);
    const body = JSON.stringify({ jobId: "job-2", status: "completed" });
    const signature = signWebhookPayload(body, SECRET);

    await handleProviderWebhook(makeRequest(body, signature), {
      secret: SECRET,
      capability: "music",
    });

    const sentEvent = sendSpy.mock.calls[0]![0] as { name: string };
    expect(sentEvent.name).toBe("atlas/music-job.webhook");
  });
});
