import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "@/src/lib/supabase/server";
import { appendAuditLog } from "@/src/lib/audit-log";
import type {
  IdempotencyKey,
  StepExecution,
  WorkflowEngine,
  WorkflowRun,
} from "@/src/types/contract";

/**
 * Supabase-backed implementation of the WorkflowEngine contract
 * (src/types/contract.ts). Inngest functions (src/workflow/inngest) call
 * this instead of touching Supabase directly, so run/step bookkeeping and
 * the audit log stay consistent no matter which durable-execution backend
 * schedules the steps.
 */
export const supabaseWorkflowEngine: WorkflowEngine = {
  async startRun({ graphId, graphVersion, tenantId, idempotencyKey, payload }) {
    const supabase = createSupabaseServiceClient();

    // Idempotent by (tenant_id, graph_id, idempotency_key): a redelivered
    // trigger returns the existing run instead of creating a duplicate.
    const { data: existing } = await supabase
      .from("runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("graph_id", graphId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      return mapRun(existing);
    }

    const { data, error } = await supabase
      .from("runs")
      .insert({
        id: randomUUID(),
        graph_id: graphId,
        graph_version: graphVersion,
        tenant_id: tenantId,
        idempotency_key: idempotencyKey,
        status: "pending",
        payload,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start run: ${error.message}`);
    }

    const run = mapRun(data);

    await appendAuditLog({
      runId: run.id,
      actor: "system",
      action: "run.created",
      toStatus: run.status,
    });

    return run;
  },

  async recordStep(execution: StepExecution) {
    const supabase = createSupabaseServiceClient();

    const { error } = await supabase.from("steps").upsert(
      {
        id: execution.id,
        run_id: execution.runId,
        node_id: execution.nodeId,
        stage_id: execution.stageId,
        kind: execution.kind,
        status: execution.status,
        attempt: execution.attempt,
        idempotency_key: execution.idempotencyKey,
        started_at: execution.startedAt ?? null,
        completed_at: execution.completedAt ?? null,
        error: execution.error ?? null,
      },
      { onConflict: "id" },
    );

    if (error) {
      throw new Error(`Failed to record step: ${error.message}`);
    }

    await appendAuditLog({
      runId: execution.runId,
      nodeId: execution.nodeId,
      actor: "system",
      action: `step.${execution.status}`,
      toStatus: execution.status,
      metadata: { attempt: execution.attempt },
    });
  },

  appendAuditLog,

  async getRun(runId: string) {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load run: ${error.message}`);
    }
    return data ? mapRun(data) : null;
  },
};

function mapRun(row: {
  id: string;
  graph_id: string;
  graph_version: string;
  tenant_id: string;
  idempotency_key: string;
  status: WorkflowRun["status"];
  created_at: string;
  updated_at: string;
}): WorkflowRun {
  return {
    id: row.id,
    graphId: row.graph_id,
    graphVersion: row.graph_version,
    tenantId: row.tenant_id,
    idempotencyKey: row.idempotency_key as IdempotencyKey,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
