import { describe, expect, it } from "vitest";
import { atlasVideoFactoryGraph } from "@/src/graph/atlas-video-factory.graph";
import { getNode, nodesForStage, outgoingEdges } from "@/src/types/graph";

describe("atlasVideoFactoryGraph structural integrity", () => {
  it("has every edge referencing a real node id", () => {
    const nodeIds = new Set(atlasVideoFactoryGraph.nodes.map((n) => n.id));
    for (const edge of atlasVideoFactoryGraph.edges) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });

  it("has no duplicate node ids", () => {
    const ids = atlasVideoFactoryGraph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all five stages from the diagram", () => {
    const stages = new Set(atlasVideoFactoryGraph.nodes.map((n) => n.stageId));
    expect(stages).toEqual(
      new Set([
        "idea_generation",
        "video_prompts",
        "generate_video",
        "create_audio",
        "assemble_publish",
      ]),
    );
  });

  it("every node with kind 'poll' declares a poll policy", () => {
    for (const node of atlasVideoFactoryGraph.nodes) {
      if (node.kind === "poll") {
        expect(node.poll).toBeDefined();
        expect(node.poll!.timeoutMs).toBeGreaterThan(0);
      }
    }
  });

  it("the human approval node requires approval", () => {
    const node = getNode(atlasVideoFactoryGraph, "human_approval");
    expect(node.requiresApproval).toBe(true);
  });

  it("throws for an unknown node id", () => {
    expect(() => getNode(atlasVideoFactoryGraph, "does-not-exist")).toThrow();
  });

  it("quality_check has both a PASS and a FAIL edge", () => {
    const edges = outgoingEdges(atlasVideoFactoryGraph, "quality_check");
    expect(edges.some((e) => e.condition === "pass")).toBe(true);
    expect(edges.some((e) => e.condition === "fail")).toBe(true);
  });

  it("nodesForStage returns only nodes in that stage", () => {
    const stage5 = nodesForStage(atlasVideoFactoryGraph, "assemble_publish");
    expect(stage5.length).toBeGreaterThan(0);
    expect(stage5.every((n) => n.stageId === "assemble_publish")).toBe(true);
  });
});
