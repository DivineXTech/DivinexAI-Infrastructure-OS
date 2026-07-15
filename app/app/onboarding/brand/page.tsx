import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandForm } from "@/components/onboarding/brand-form";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { getBrandProfile } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";
import type { BrandStepInput } from "@/lib/validation/onboarding";

export default async function BrandStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("brand");
  const existing = await getBrandProfile(session.tenantId);

  const defaultValues: Partial<BrandStepInput> = existing
    ? {
        brandName: existing.brandName,
        tagline: existing.tagline ?? "",
        description: existing.description ?? "",
        primaryColor: existing.primaryColor ?? "",
        secondaryColor: existing.secondaryColor ?? "",
        accentColor: existing.accentColor ?? "",
        typography: existing.typography ?? "",
        personality: (existing.personality ?? undefined) as BrandStepInput["personality"],
        personalityOther: existing.personalityOther ?? "",
        existingWebsite: existing.existingWebsite ?? "",
        logoPath: existing.logoPath ?? "",
      }
    : {};

  return (
    <WizardShell
      currentStep="brand"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Brand identity</CardTitle>
          <CardDescription>Name, colors, typography, and personality.</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
