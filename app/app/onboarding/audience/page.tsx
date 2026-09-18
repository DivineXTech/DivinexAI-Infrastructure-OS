import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AudienceForm } from "@/components/onboarding/audience-form";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { getAudience } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";
import type { AudienceStepInput } from "@/lib/validation/onboarding";

export default async function AudienceStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("audience");
  const existing = await getAudience(session.tenantId);

  const defaultValues: Partial<AudienceStepInput> = existing
    ? {
        customerTypes: existing.customerTypes,
        ageRanges: existing.ageRanges,
        geographicFocus: existing.geographicFocus ?? "",
        marketType: existing.marketType ?? undefined,
        stylePreferences: existing.stylePreferences,
        purchaseMotivation: existing.purchaseMotivation ?? "",
        priceSensitivity: existing.priceSensitivity ?? "",
        primarySalesChannel: existing.primarySalesChannel ?? "",
      }
    : {};

  return (
    <WizardShell
      currentStep="audience"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Audience</CardTitle>
          <CardDescription>Who you&rsquo;re building this brand for.</CardDescription>
        </CardHeader>
        <CardContent>
          <AudienceForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
