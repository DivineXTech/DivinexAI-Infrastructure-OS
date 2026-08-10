import { beforeEach, describe, expect, it, vi } from "vitest";
import { InngestTestEngine } from "@inngest/test";

// appendAuditLog (src/lib/audit-log.ts) hits real Supabase and is called
// directly in assembleAndPublish's body rather than through step.run (it
// isn't itself replay-sensitive state), so it needs mocking here — every
// other Supabase touch point in the function is wrapped in step.run and is
// mocked below via InngestTestEngine's step mocks instead.
vi.mock("@/src/workflow/engine", () => ({
  supabaseWorkflowEngine: {
    appendAuditLog: vi.fn().mockResolvedValue({
      id: "audit-1",
      runId: "run-1",
      actor: "system",
      action: "mock",
      createdAt: new Date().toISOString(),
    }),
    startRun: vi.fn(),
    recordStep: vi.fn(),
    getRun: vi.fn(),
  },
}));

const { assembleAndPublish } = await import("@/src/workflow/inngest/functions");
const { supabaseWorkflowEngine } = await import("@/src/workflow/engine");

const assemblyData = {
  run: { id: "run-1", tenant_id: "tenant-1", simulation_mode: true },
  script: { title: "Test Video", music_mood: "calm" },
  scenes: [
    {
      order: 0,
      durationSeconds: 5,
      captionText: "Hello",
      videoUrl: "https://cdn.example.com/scene-0.json",
      narrationUrl: "https://cdn.example.com/narration-0.json",
      simulated: true,
    },
  ],
  musicUrl: "https://cdn.example.com/music.json",
  musicSimulated: true,
};

const compositionResult = {
  outputPath: "final/run-1/composition.simulated.json",
  url: "https://cdn.example.com/final.json",
  simulated: true,
  costUsd: 0,
  durationSeconds: 5,
  note: "mock composition",
};

const preApprovalSteps = [
  { id: "claim-run", handler: () => true },
  { id: "load-assembly-data", handler: () => assemblyData },
  { id: "compose-video-1", handler: () => compositionResult },
  { id: "quality-check-1", handler: () => true },
  { id: "persist-final-artifact", handler: () => undefined },
  { id: "load-tenant-policy", handler: () => ({ requireApprovalBeforePublish: true }) },
];

/**
 * @inngest/test@1.0.0's step mocking has a known interop issue with
 * inngest@4's engine when mocking the *resolved value* of a
 * `step.waitForEvent` call specifically (the engine reads the mocked
 * result before the mock's deferred promise has settled, so it always
 * observes an empty/pending value and fails event-schema validation
 * against it — reproduced and confirmed via a temporary debug patch to
 * node_modules/inngest during development, not something fixable from this
 * package). Runnable steps (step.run) mock and resume correctly, as the
 * "does not call publish before approval arrives" case below shows.
 *
 * So this suite verifies the approval gate two ways instead:
 *   1. The function genuinely pauses on `step.waitForEvent` with the
 *      correct event name and a run-scoped `if` condition (below).
 *   2. The condition and event name line up with exactly what
 *      POST /api/runs/:runId/approve sends (tests/integration/approve-route.test.ts).
 * Together these cover "does the gate wait for the right thing" and "does
 * approving a run send the right thing" — the two halves of resuming
 * correctly — without depending on the broken mock-resolution path.
 */
describe("assembleAndPublish — approval gate", () => {
  const engine = new InngestTestEngine({
    function: assembleAndPublish,
    events: [{ name: "atlas/assets.ready", data: { tenantId: "tenant-1", runId: "run-1" } }],
  });

  beforeEach(() => {
    vi.mocked(supabaseWorkflowEngine.appendAuditLog).mockClear();
  });

  it("pauses on a WaitForEvent step for atlas/approval.granted scoped to this run", async () => {
    const { step } = await engine.executeStep("wait-for-human-approval", {
      steps: preApprovalSteps,
    });

    expect(step.op).toBe("WaitForEvent");
    expect(step.name).toBe("atlas/approval.granted");
    expect(step.opts?.if).toContain("run-1");
    expect(step.opts?.timeout).toBeDefined();
  });

  it("does not call publish before approval arrives", async () => {
    const { state } = await engine.executeStep("wait-for-human-approval", {
      steps: preApprovalSteps,
    });
    expect(state["publish"]).toBeUndefined();
  });

  it("records quality_check.passed before reaching the approval gate", async () => {
    await engine.executeStep("wait-for-human-approval", { steps: preApprovalSteps });

    const auditActions = vi
      .mocked(supabaseWorkflowEngine.appendAuditLog)
      .mock.calls.map(([entry]) => entry.action);
    expect(auditActions).toContain("quality_check.passed");
    expect(auditActions).not.toContain("run.published");
  });
});
