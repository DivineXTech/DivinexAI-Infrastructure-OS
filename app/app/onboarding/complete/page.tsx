import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOnboardingReviewAccess } from "@/lib/onboarding/guard";
import { getLaunchReadinessAssessment } from "@/lib/onboarding/data-access";

export default async function OnboardingCompletePage() {
  const access = await requireOnboardingReviewAccess();

  if (!access.session || access.session.status !== "completed") {
    redirect("/app/onboarding/review");
  }

  const readiness = access.canEdit ? await getLaunchReadinessAssessment(access.membership.tenantId) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Onboarding complete</CardTitle>
          <CardDescription>
            Your brand setup is saved. You can revisit and edit any step later from your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {readiness ? (
            <p className="text-sm text-ink-muted">
              Launch readiness: <span className="font-medium text-ink">{readiness.totalScore}/100</span> —{" "}
              {readiness.label}
            </p>
          ) : null}
          <Button asChild>
            <Link href="/app">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
