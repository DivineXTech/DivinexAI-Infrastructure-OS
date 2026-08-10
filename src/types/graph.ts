/**
 * Canonical workflow graph model for the Atlas AI Video Factory.
 *
 * This module is the single source of truth for the shape of the pipeline.
 * Every execution engine (Inngest functions, a future Trigger.dev port, the
 * React Flow designer, docs generators) reads its topology from here instead
 * of re-declaring it, so the diagram, the runtime, and the UI can never
 * drift apart.
 */

/** The five top-level stages shown in the Atlas AI Video Factory diagram. */
export type StageId =
  | "idea_generation"
  | "video_prompts"
  | "generate_video"
  | "create_audio"
  | "assemble_publish";

/** How a step is invoked by the execution engine. */
export type StepKind =
  | "trigger" // schedule / webhook entry point
  | "ai_agent" // Claude call producing schema-validated structured output
  | "storage" // durable read/write against Supabase (or the storage provider)
  | "webhook" // fire-and-forget or awaited call to an external job API
  | "poll" // bounded polling loop against an external job API
  | "tool" // deterministic local computation (merge, transcode, etc.)
  | "human" // human-in-the-loop approval gate
  | "quality_check"; // automated pass/fail gate with a FAIL retry edge

/** Declarative retry policy attached to any step that can transiently fail. */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoff: "fixed" | "exponential";
  readonly initialDelayMs: number;
  /** Upper bound so exponential backoff can't grow unbounded. */
  readonly maxDelayMs: number;
}

/** Bounded polling configuration for steps of kind "poll". */
export interface PollPolicy {
  readonly intervalMs: number;
  readonly timeoutMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoff: "exponential",
  initialDelayMs: 1_000,
  maxDelayMs: 60_000,
};

export const DEFAULT_POLL_POLICY: PollPolicy = {
  intervalMs: 5_000,
  timeoutMs: 15 * 60_000,
};

/** A single node in the canonical graph — one box in the diagram. */
export interface GraphNode {
  readonly id: string;
  readonly stageId: StageId;
  readonly kind: StepKind;
  readonly label: string;
  /** Name of the Zod schema (from src/schemas) validating this node's output, if any. */
  readonly outputSchema?: string;
  readonly retry?: RetryPolicy;
  readonly poll?: PollPolicy;
  /** Marks a node that halts the run until a human acts (Stage 5 approval gate). */
  readonly requiresApproval?: boolean;
}

/** A directed edge between two nodes. `condition` models PASS/FAIL branches. */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: "pass" | "fail" | "retry";
}

export interface WorkflowGraph {
  readonly id: string;
  readonly version: string;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export function getNode(graph: WorkflowGraph, id: string): GraphNode {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) {
    throw new Error(`Unknown node "${id}" in graph "${graph.id}"`);
  }
  return node;
}

export function outgoingEdges(
  graph: WorkflowGraph,
  nodeId: string,
): readonly GraphEdge[] {
  return graph.edges.filter((e) => e.from === nodeId);
}

export function nodesForStage(
  graph: WorkflowGraph,
  stageId: StageId,
): readonly GraphNode[] {
  return graph.nodes.filter((n) => n.stageId === stageId);
}
