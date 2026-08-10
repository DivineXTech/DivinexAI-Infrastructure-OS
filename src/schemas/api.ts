import { z } from "zod";

/** POST /api/runs body — manually triggers Stage 1 (Idea Generation). */
export const startRunRequestSchema = z.object({
  tenantId: z.string().uuid(),
  /** Caller-supplied natural key for idempotency (e.g. a UI request id).
   *  Defaults to a fresh key, i.e. always starts a new run, when omitted. */
  idempotencyKey: z.string().min(8).optional(),
});

/** POST /api/runs/:runId/approve body — grants Stage 5's human approval gate. */
export const approveRunRequestSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().min(1),
});
