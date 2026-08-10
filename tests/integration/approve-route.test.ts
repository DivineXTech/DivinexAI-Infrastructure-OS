import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/runs/[runId]/approve/route";
import { inngest } from "@/src/workflow/inngest/client";

function makeRequest(runId: string, body: unknown): Request {
  return new Request(`https://app.example.com/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/runs/:runId/approve", () => {
  it("sends an atlas/approval.granted event scoped to the run id in the URL", async () => {
    const sendSpy = vi.spyOn(inngest, "send").mockResolvedValue({ ids: ["evt-1"] } as never);

    const response = await POST(
      makeRequest("run-1", { tenantId: "123e4567-e89b-12d3-a456-426614174000", userId: "user-1" }) as never,
      { params: Promise.resolve({ runId: "run-1" }) },
    );

    expect(response.status).toBe(200);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const event = sendSpy.mock.calls[0]![0] as { name: string; data: Record<string, unknown> };
    expect(event.name).toBe("atlas/approval.granted");
    expect(event.data).toMatchObject({ runId: "run-1", userId: "user-1" });

    sendSpy.mockRestore();
  });

  it("rejects a request missing userId", async () => {
    const response = await POST(
      makeRequest("run-1", { tenantId: "123e4567-e89b-12d3-a456-426614174000" }) as never,
      { params: Promise.resolve({ runId: "run-1" }) },
    );
    expect(response.status).toBe(422);
  });

  it("rejects malformed JSON", async () => {
    const request = new Request("https://app.example.com/api/runs/run-1/approve", {
      method: "POST",
      body: "not json",
    });
    const response = await POST(request as never, { params: Promise.resolve({ runId: "run-1" }) });
    expect(response.status).toBe(400);
  });
});
