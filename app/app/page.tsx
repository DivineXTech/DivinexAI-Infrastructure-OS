import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { STAFF_ROLES, TENANT_ADMIN_ROLES } from "@/lib/auth/roles";
import { getLaunchReadinessAssessment } from "@/lib/onboarding/data-access";
import { getOnboardingSession, getStepProgress } from "@/lib/onboarding/session";
import { computeCurrentStep } from "@/lib/onboarding/progress";
import { stepMeta } from "@/lib/onboarding/steps";

const METRICS = [
  "Total sales",
  "Total orders",
  "Orders awaiting production",
  "Orders in production",
  "Orders ready to ship",
  "Inventory alerts",
  "Storefront traffic",
  "Conversion rate",
  "Average order value",
] as const;

export default async function DashboardPage() {
  const membership = await requireCurrentTenantRole(STAFF_ROLES);
  const canSeeReadiness = TENANT_ADMIN_ROLES.includes(membership.roleKey);

  const session = await getOnboardingSession(membership.tenantId);
  const stepProgress = session ? await getStepProgress(membership.tenantId, session.id) : [];
  const readiness =
    canSeeReadiness && session ? await getLaunchReadinessAssessment(membership.tenantId) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{membership.tenantName}</h1>
        <p className="text-sm text-ink-muted">
          Launch readiness and operations at a glance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Launch readiness</CardTitle>
          <CardDescription>
            Onboarding completion and recommended next actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!session ? (
            <>
              <p className="text-sm text-ink-muted">Onboarding hasn&apos;t started yet.</p>
              {canSeeReadiness ? (
                <Button asChild size="sm" className="self-start">
                  <Link href="/app/onboarding/welcome">Start onboarding</Link>
                </Button>
              ) : null}
            </>
          ) : session.status === "completed" ? (
            <>
              {readiness ? (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-semibold text-ink">{readiness.totalScore}</span>
                  <Badge variant="accent">{readiness.label}</Badge>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Onboarding complete.</p>
              )}
              <Button asChild variant="outline" size="sm" className="self-start">
                <Link href="/app/onboarding/review">Review setup</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">
                Onboarding is {session.completionPercentage}% complete.
              </p>
              {canSeeReadiness ? (
                <Button asChild size="sm" className="self-start">
                  <Link href={stepMeta(computeCurrentStep(stepProgress)).href}>
                    Resume onboarding
                  </Link>
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((metric) => (
          <Card key={metric}>
            <CardHeader className="pb-2">
              <CardDescription>{metric}</CardDescription>
              <CardTitle className="text-2xl">—</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">No data yet</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        In development/demo mode, seeded metrics will be clearly labeled
        &ldquo;Demo data&rdquo; rather than shown as live figures.
      </p>
    </div>
  );
}
