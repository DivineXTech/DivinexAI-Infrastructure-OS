"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { completeOnboardingAction, recalculateLaunchReadinessAction } from "@/app/app/onboarding/wizard-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LaunchReadinessResult } from "@/lib/onboarding/launch-readiness-engine";
import type { OnboardingReviewSection } from "@/lib/onboarding/guard";

export type ReviewSectionSummary = {
  key: OnboardingReviewSection;
  label: string;
  href: string;
  lines: string[];
};

export function ReviewPanel({
  canEdit,
  sections,
  readiness,
}: {
  canEdit: boolean;
  sections: ReviewSectionSummary[];
  readiness: LaunchReadinessResult | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecalculate() {
    setBusy(true);
    setError(null);
    const result = await recalculateLaunchReadinessAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleComplete() {
    setBusy(true);
    setError(null);
    const result = await completeOnboardingAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/app/onboarding/complete");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{section.label}</CardTitle>
                {canEdit ? (
                  <Link href={section.href} className="text-sm text-accent underline-offset-4 hover:underline">
                    Edit
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {section.lines.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm text-ink-muted">
                  {section.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-subtle">Not filled in yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Launch readiness</CardTitle>
            <CardDescription>
              An operational-planning score, not a prediction of business success.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {readiness ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-semibold text-ink">{readiness.totalScore}</span>
                  <Badge variant="accent">{readiness.label}</Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(readiness.categoryScores).map(([key, score]) => (
                    <div key={key} className="flex items-center justify-between text-sm text-ink-muted">
                      <span className="capitalize">{key.replace(/_/g, " ")}</span>
                      <span>
                        {score}/{readiness.categoryMax[key as keyof typeof readiness.categoryMax]}
                      </span>
                    </div>
                  ))}
                </div>
                {readiness.blockingIssues.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-destructive">Blocking issues</p>
                    <ul className="list-disc pl-5 text-sm text-ink-muted">
                      {readiness.blockingIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {readiness.priorityActions.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-ink">Priority actions</p>
                    <ul className="list-disc pl-5 text-sm text-ink-muted">
                      {readiness.priorityActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-ink-muted">Not calculated yet.</p>
            )}
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={handleRecalculate} className="self-start">
              {readiness ? "Recalculate" : "Calculate my launch readiness"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {canEdit ? (
        <Button type="button" disabled={busy} onClick={handleComplete} className="self-start">
          {busy ? "Completing…" : "Complete onboarding"}
        </Button>
      ) : (
        <p className="text-sm text-ink-subtle">
          You have read-only access to this review. Only a brand owner or admin can complete onboarding.
        </p>
      )}
    </div>
  );
}
