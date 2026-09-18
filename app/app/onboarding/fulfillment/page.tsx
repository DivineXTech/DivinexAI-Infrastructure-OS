import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FulfillmentForm } from "@/components/onboarding/fulfillment-form";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { getFulfillmentPreferences } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";
import type { FulfillmentStepInput } from "@/lib/validation/onboarding";

export default async function FulfillmentStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("fulfillment");
  const existing = await getFulfillmentPreferences(session.tenantId);

  const defaultValues: Partial<FulfillmentStepInput> = existing
    ? {
        fulfillmentModel: (existing.fulfillmentModel ?? undefined) as FulfillmentStepInput["fulfillmentModel"],
        productionLeadTimeDays: existing.productionLeadTimeDays ?? undefined,
        pickupLocationPlaceholder: existing.pickupLocationPlaceholder ?? "",
        shippingRegions: existing.shippingRegions,
        returnPolicyStatus: existing.returnPolicyStatus ?? undefined,
        packagingPreference: existing.packagingPreference ?? "",
        trackingRequired: existing.trackingRequired,
        qcResponsibility: existing.qcResponsibility ?? "",
      }
    : {};

  return (
    <WizardShell
      currentStep="fulfillment"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Fulfillment</CardTitle>
          <CardDescription>How orders get produced, packaged, and shipped.</CardDescription>
        </CardHeader>
        <CardContent>
          <FulfillmentForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
