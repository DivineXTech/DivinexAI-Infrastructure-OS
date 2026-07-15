import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionForm } from "@/components/onboarding/production-form";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { getProductionPreferences } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";
import type { ProductionStepInput } from "@/lib/validation/onboarding";

export default async function ProductionStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("production");
  const existing = await getProductionPreferences(session.tenantId);

  const defaultValues: Partial<ProductionStepInput> = existing
    ? {
        preferredMethod: (existing.preferredMethod ?? undefined) as ProductionStepInput["preferredMethod"],
        experienceLevel: existing.experienceLevel ?? undefined,
        workspace: (existing.workspace ?? undefined) as ProductionStepInput["workspace"],
        expectedMonthlyVolume: existing.expectedMonthlyVolume ?? undefined,
        equipmentOwned: existing.equipmentOwned,
        existingEquipment: existing.existingEquipment ?? "",
        outsourcingPreference: existing.outsourcingPreference ?? "",
      }
    : {};

  return (
    <WizardShell
      currentStep="production"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Production method</CardTitle>
          <CardDescription>How you&rsquo;ll produce your products.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductionForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
