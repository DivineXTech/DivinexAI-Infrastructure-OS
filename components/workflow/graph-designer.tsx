"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import type { WorkflowGraph } from "@/src/types/graph";

const STAGE_COLORS: Record<string, string> = {
  idea_generation: "#a855f7",
  video_prompts: "#3b82f6",
  generate_video: "#22c55e",
  create_audio: "#eab308",
  assemble_publish: "#ec4899",
};

const STAGE_COLUMN: Record<string, number> = {
  idea_generation: 0,
  video_prompts: 1,
  generate_video: 2,
  create_audio: 3,
  assemble_publish: 4,
};

/**
 * Renders the canonical WorkflowGraph (src/graph/atlas-video-factory.graph.ts)
 * with React Flow. This is a read-only visualization of the same topology
 * the Inngest functions execute — it takes a WorkflowGraph as a prop rather
 * than hardcoding nodes, so any graph edit is reflected here for free.
 */
export function WorkflowGraphDesigner({ graph }: { graph: WorkflowGraph }) {
  const nodes = useMemo<Node[]>(() => {
    const perStageCount: Record<string, number> = {};
    return graph.nodes.map((node) => {
      const column = STAGE_COLUMN[node.stageId] ?? 0;
      const row = perStageCount[node.stageId] ?? 0;
      perStageCount[node.stageId] = row + 1;

      return {
        id: node.id,
        position: { x: column * 260, y: row * 110 },
        data: { label: node.label },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: "#18181b",
          color: "#fafafa",
          border: `1px solid ${STAGE_COLORS[node.stageId] ?? "#52525b"}`,
          borderRadius: 8,
          padding: 8,
          fontSize: 12,
          width: 200,
        },
      };
    });
  }, [graph.nodes]);

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge, index) => ({
        id: `${edge.from}-${edge.to}-${index}`,
        source: edge.from,
        target: edge.to,
        animated: edge.condition === "retry",
        label: edge.condition,
        style: {
          stroke: edge.condition === "fail" ? "#ef4444" : "#71717a",
        },
      })),
    [graph.edges],
  );

  return (
    <div style={{ width: "100%", height: "70vh" }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
