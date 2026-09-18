import { STEP_KEYS, stepIndex, type StepKey } from "@/lib/onboarding/steps";

export type StepProgressStatus = "not_started" | "in_progress" | "completed";

export type StepProgressRow = {
  stepKey: StepKey;
  status: StepProgressStatus;
};

/**
 * Percentage of the wizard completed, based purely on which steps have a
 * `completed` progress row — no I/O, so this is the same function the
 * dashboard, the wizard shell, and the review page all call rather than
 * three separate ad hoc calculations.
 */
export function computeCompletionPercentage(stepProgress: StepProgressRow[]): number {
  const completedCount = STEP_KEYS.filter(
    (key) => stepProgress.find((r) => r.stepKey === key)?.status === "completed",
  ).length;
  return Math.round((completedCount / STEP_KEYS.length) * 100);
}

/**
 * The first step that isn't marked `completed`, in canonical order — this
 * is the resumable "pick up where you left off" target, and also what
 * `isStepAccessible` uses to decide whether a requested step is unlocked.
 * If every step is completed, resolves to the last step (`review`), which
 * is where completion itself happens.
 */
export function computeCurrentStep(stepProgress: StepProgressRow[]): StepKey {
  for (const key of STEP_KEYS) {
    const row = stepProgress.find((r) => r.stepKey === key);
    if (!row || row.status !== "completed") return key;
  }
  return STEP_KEYS[STEP_KEYS.length - 1];
}

/**
 * A step is accessible if it's at or before the current (first-incomplete)
 * step — i.e. already completed (editable) or the next one to do. Anything
 * further ahead is locked: you can't skip from "brand" to "budget" without
 * completing "audience"/"products"/"production" first.
 */
export function isStepAccessible(
  requestedKey: StepKey,
  stepProgress: StepProgressRow[],
): boolean {
  const current = computeCurrentStep(stepProgress);
  return stepIndex(requestedKey) <= stepIndex(current);
}
