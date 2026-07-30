import type { Queryable } from "@repo/shared";

/**
 * Advances every `PENDING` step of a run whose dependencies are all
 * satisfied (`SUCCEEDED` or `SKIPPED`) to `READY`. A single atomic UPDATE —
 * entry steps (no dependency rows at all) satisfy the `not exists` clause
 * trivially, so this same call handles both "first-time readying of entry
 * steps after materialization" and "readying a step once its last sibling
 * finishes." Safe to call repeatedly: steps already past `PENDING` simply
 * don't match the WHERE clause on a later call (idempotent by construction).
 */
export async function computeReadySteps(
  db: Queryable,
  workflowRunId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `update workflow_steps ws
     set status = 'READY', updated_at = now()
     where ws.workflow_run_id = $1
       and ws.status = 'PENDING'
       and not exists (
         select 1
         from workflow_step_dependencies d
         join workflow_steps dep on dep.id = d.depends_on_step_id
         where d.step_id = ws.id
           and dep.status not in ('SUCCEEDED', 'SKIPPED')
       )
     returning ws.id`,
    [workflowRunId],
  );
  return rows.map((r) => r.id);
}
