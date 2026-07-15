import "server-only";

import { writeAuditLog } from "@/lib/audit/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompletionPercentage, computeCurrentStep, type StepProgressRow } from "@/lib/onboarding/progress";
import type { StepKey } from "@/lib/onboarding/steps";

export type OnboardingSessionStatus = "in_progress" | "needs_review" | "completed" | "archived";

export type OnboardingSession = {
  id: string;
  tenantId: string;
  startedBy: string;
  currentStep: string;
  completionPercentage: number;
  status: OnboardingSessionStatus;
  startedAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  version: number;
};

const SESSION_COLUMNS =
  "id, tenant_id, started_by, current_step, completion_percentage, status, started_at, last_activity_at, completed_at, version";

type SessionRow = {
  id: string;
  tenant_id: string;
  started_by: string;
  current_step: string;
  completion_percentage: number;
  status: OnboardingSessionStatus;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  version: number;
};

function mapSession(row: SessionRow): OnboardingSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    startedBy: row.started_by,
    currentStep: row.current_step,
    completionPercentage: row.completion_percentage,
    status: row.status,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    completedAt: row.completed_at,
    version: row.version,
  };
}

/** Explicitly scoped by tenantId — the caller resolves tenantId from the
 * authenticated session (lib/onboarding/guard.ts), never from client
 * input. One row per tenant, so no membership-row ambiguity applies here
 * (see docs/SECURITY.md "Membership row-scoping fix" for why that
 * distinction matters). */
export async function getOnboardingSession(tenantId: string): Promise<OnboardingSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("onboarding_sessions")
    .select(SESSION_COLUMNS)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data ? mapSession(data) : null;
}

export async function getStepProgress(
  tenantId: string,
  sessionId: string,
): Promise<StepProgressRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("onboarding_step_progress")
    .select("step_key, status")
    .eq("tenant_id", tenantId)
    .eq("session_id", sessionId);
  return (data ?? []).map((r) => ({
    stepKey: r.step_key as StepKey,
    status: r.status,
  }));
}

/**
 * Starts a new onboarding session, or resumes (and reopens, if archived)
 * an existing one. Idempotent under normal use: a second call for the
 * same tenant just touches `last_activity_at`. The brief race between the
 * existence check and the insert (two concurrent first-visits) is caught
 * by the table's `tenant_id unique` constraint — a losing insert falls
 * back to the update path rather than erroring the request.
 */
export async function startOrResumeOnboardingSession(
  tenantId: string,
  profileId: string,
): Promise<OnboardingSession> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const existing = await getOnboardingSession(tenantId);
  if (existing) {
    const wasArchived = existing.status === "archived";
    const { data, error } = await supabase
      .from("onboarding_sessions")
      .update({
        last_activity_at: nowIso,
        ...(wasArchived ? { status: "in_progress" as const } : {}),
        version: existing.version + 1,
      })
      .eq("tenant_id", tenantId)
      .select(SESSION_COLUMNS)
      .single();
    if (error || !data) throw new Error("Failed to resume onboarding session");

    if (wasArchived) {
      await writeAuditLog({
        tenantId,
        actorProfileId: profileId,
        action: "onboarding.reopened",
        targetTable: "onboarding_sessions",
        targetId: data.id,
      });
    }
    return mapSession(data);
  }

  const { data, error } = await supabase
    .from("onboarding_sessions")
    .insert({ tenant_id: tenantId, started_by: profileId })
    .select(SESSION_COLUMNS)
    .single();

  if (error) {
    // Unique-violation race: someone else's concurrent request created the
    // row first. Fall back to resuming it instead of failing the request.
    const raced = await getOnboardingSession(tenantId);
    if (raced) return raced;
    throw new Error(`Failed to start onboarding session: ${error.message}`);
  }

  await writeAuditLog({
    tenantId,
    actorProfileId: profileId,
    action: "onboarding.started",
    targetTable: "onboarding_sessions",
    targetId: data.id,
  });

  return mapSession(data);
}

/**
 * Marks a step completed, then recomputes and persists the session's
 * `current_step`/`completion_percentage` from the full, just-fetched step
 * list — never trusts a client-supplied percentage or step name.
 */
export async function markStepCompleted(
  session: OnboardingSession,
  stepKey: StepKey,
  actorProfileId: string,
  { isEdit = false }: { isEdit?: boolean } = {},
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { error: stepError } = await supabase.from("onboarding_step_progress").upsert(
    {
      session_id: session.id,
      tenant_id: session.tenantId,
      step_key: stepKey,
      status: "completed",
      completed_at: nowIso,
    },
    { onConflict: "session_id,step_key" },
  );
  if (stepError) throw new Error(`Failed to save step progress: ${stepError.message}`);

  const allProgress = await getStepProgress(session.tenantId, session.id);
  const completionPercentage = computeCompletionPercentage(allProgress);
  const currentStep = computeCurrentStep(allProgress);

  const { error: sessionError } = await supabase
    .from("onboarding_sessions")
    .update({
      completion_percentage: completionPercentage,
      current_step: currentStep,
      last_activity_at: nowIso,
      version: session.version + 1,
    })
    .eq("tenant_id", session.tenantId);
  if (sessionError) {
    throw new Error(`Failed to update onboarding progress: ${sessionError.message}`);
  }

  await writeAuditLog({
    tenantId: session.tenantId,
    actorProfileId,
    action: isEdit ? "onboarding.step_edited" : "onboarding.step_completed",
    targetTable: "onboarding_step_progress",
    metadata: { stepKey },
  });
}

export async function completeOnboardingSession(
  session: OnboardingSession,
  actorProfileId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("onboarding_sessions")
    .update({
      status: "completed",
      completed_at: nowIso,
      last_activity_at: nowIso,
      version: session.version + 1,
    })
    .eq("tenant_id", session.tenantId);
  if (error) throw new Error(`Failed to complete onboarding: ${error.message}`);

  await writeAuditLog({
    tenantId: session.tenantId,
    actorProfileId,
    action: "onboarding.completed",
    targetTable: "onboarding_sessions",
    targetId: session.id,
  });
}
