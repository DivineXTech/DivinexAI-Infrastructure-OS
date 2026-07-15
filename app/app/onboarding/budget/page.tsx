import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetForm } from "@/components/onboarding/budget-form";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { getBudgetProfile } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";
import type { BudgetStepInput } from "@/lib/validation/onboarding";

function centsToDollars(cents: number | null): number | undefined {
  return cents !== null ? cents / 100 : undefined;
}

export default async function BudgetStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("budget");
  const existing = await getBudgetProfile(session.tenantId);

  const defaultValues: Partial<BudgetStepInput> = existing
    ? {
        budgetBand: existing.budgetBand as BudgetStepInput["budgetBand"],
        preciseTotalCents: centsToDollars(existing.preciseTotalCents),
        allocationEquipmentCents: centsToDollars(existing.allocationEquipmentCents),
        allocationBlankApparelCents: centsToDollars(existing.allocationBlankApparelCents),
        allocationBrandingCents: centsToDollars(existing.allocationBrandingCents),
        allocationStorefrontCents: centsToDollars(existing.allocationStorefrontCents),
        allocationMarketingCents: centsToDollars(existing.allocationMarketingCents),
        allocationPackagingCents: centsToDollars(existing.allocationPackagingCents),
        allocationTrainingCents: centsToDollars(existing.allocationTrainingCents),
        allocationWorkingCapitalCents: centsToDollars(existing.allocationWorkingCapitalCents),
      }
    : {};

  return (
    <WizardShell
      currentStep="budget"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Launch budget</CardTitle>
          <CardDescription>Planning guidance, not a financial commitment.</CardDescription>
        </CardHeader>
        <CardContent>
          <BudgetForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
