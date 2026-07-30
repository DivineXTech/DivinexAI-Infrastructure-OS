import { describe, expect, it } from "vitest";
import { parseAgentExecutionResult } from "../src/executionResult.js";

function buildResult(overrides: Record<string, unknown> = {}) {
  return {
    status: "completed",
    summary: "Completed the market assessment",
    output: { marketSize: "large" },
    evidence: [{ source: "internal-report", quote: "..." }],
    assumptions: ["Client operates primarily in the US market"],
    uncertainty: "low",
    recommendedNextAction: "Proceed to pricing analysis",
    requestedHandoff: null,
    approvalRequired: false,
    riskFlags: [],
    memoryCandidates: [
      {
        category: "episodic",
        content: { note: "..." },
        provenance: "pulse-agent-run",
        confidence: 0.8,
      },
    ],
    evaluationMetadata: {
      modelUsed: "mock-model",
      tokensUsed: 1200,
      latencyMs: 850,
      toolCallCount: 2,
    },
    ...overrides,
  };
}

describe("parseAgentExecutionResult", () => {
  it("accepts a well-formed result", () => {
    const result = parseAgentExecutionResult(buildResult());
    expect(result.status).toBe("completed");
    expect(result.requestedHandoff).toBeNull();
  });

  it("accepts a requested handoff", () => {
    const result = parseAgentExecutionResult(
      buildResult({
        requestedHandoff: {
          targetAgentId: "nova",
          reason: "needs re-planning",
        },
      }),
    );
    expect(result.requestedHandoff).toEqual({
      targetAgentId: "nova",
      reason: "needs re-planning",
    });
  });

  it("rejects an invalid status value", () => {
    expect(() =>
      parseAgentExecutionResult(buildResult({ status: "done" })),
    ).toThrow();
  });

  it("rejects a memory candidate with confidence out of range", () => {
    expect(() =>
      parseAgentExecutionResult(
        buildResult({
          memoryCandidates: [
            {
              category: "episodic",
              content: {},
              provenance: "x",
              confidence: 1.5,
            },
          ],
        }),
      ),
    ).toThrow();
  });

  it("rejects a memory candidate missing provenance", () => {
    expect(() =>
      parseAgentExecutionResult(
        buildResult({
          memoryCandidates: [
            { category: "working", content: {}, confidence: null },
          ],
        }),
      ),
    ).toThrow();
  });

  it("rejects a missing summary", () => {
    const result = buildResult();
    delete (result as Record<string, unknown>).summary;
    expect(() => parseAgentExecutionResult(result)).toThrow();
  });
});
