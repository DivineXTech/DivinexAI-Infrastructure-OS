import { describe, expect, it } from "vitest";

import {
  computeCompletionPercentage,
  computeCurrentStep,
  isStepAccessible,
  type StepProgressRow,
} from "@/lib/onboarding/progress";
import { STEP_KEYS } from "@/lib/onboarding/steps";

function rows(completedKeys: (typeof STEP_KEYS)[number][]): StepProgressRow[] {
  return completedKeys.map((stepKey) => ({ stepKey, status: "completed" as const }));
}

describe("computeCompletionPercentage", () => {
  it("is 0 for no progress", () => {
    expect(computeCompletionPercentage([])).toBe(0);
  });

  it("is 100 when every step is completed", () => {
    expect(computeCompletionPercentage(rows([...STEP_KEYS]))).toBe(100);
  });

  it("is proportional for partial progress", () => {
    const pct = computeCompletionPercentage(rows(["welcome", "brand"]));
    expect(pct).toBe(Math.round((2 / STEP_KEYS.length) * 100));
  });
});

describe("computeCurrentStep", () => {
  it("is the first step when nothing is completed", () => {
    expect(computeCurrentStep([])).toBe("welcome");
  });

  it("is the first incomplete step after some completions", () => {
    expect(computeCurrentStep(rows(["welcome", "brand"]))).toBe("audience");
  });

  it("stays on the last step once everything is completed (no crash, no out-of-bounds)", () => {
    expect(computeCurrentStep(rows([...STEP_KEYS]))).toBe("review");
  });

  it("treats a non-completed row (e.g. in_progress) the same as missing", () => {
    const progress: StepProgressRow[] = [
      { stepKey: "welcome", status: "completed" },
      { stepKey: "brand", status: "in_progress" },
    ];
    expect(computeCurrentStep(progress)).toBe("brand");
  });
});

describe("isStepAccessible", () => {
  it("allows the current step and every already-completed step, denies anything ahead", () => {
    const progress = rows(["welcome", "brand"]);
    expect(isStepAccessible("welcome", progress)).toBe(true);
    expect(isStepAccessible("brand", progress)).toBe(true);
    expect(isStepAccessible("audience", progress)).toBe(true); // current step
    expect(isStepAccessible("budget", progress)).toBe(false); // locked, ahead of current
  });

  it("allows every step once onboarding is fully complete", () => {
    const progress = rows([...STEP_KEYS]);
    for (const key of STEP_KEYS) {
      expect(isStepAccessible(key, progress)).toBe(true);
    }
  });

  it("allows re-visiting (editing) a step even if later steps are also complete", () => {
    const progress = rows(["welcome", "brand", "audience", "products"]);
    expect(isStepAccessible("brand", progress)).toBe(true);
  });
});
