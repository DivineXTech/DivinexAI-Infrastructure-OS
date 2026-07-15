import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductsForm } from "@/components/onboarding/products-form";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { getProductPreferences } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";
import type { ProductsStepInput } from "@/lib/validation/onboarding";

export default async function ProductsStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("products");
  const existing = await getProductPreferences(session.tenantId);

  const defaultValues: Partial<ProductsStepInput> = existing
    ? {
        categories: existing.categories,
        launchQuantity: existing.launchQuantity ?? undefined,
        initialDesignCount: existing.initialDesignCount ?? undefined,
        sizeRange: existing.sizeRange ?? "",
        colorRange: existing.colorRange ?? "",
        customizationRequirements: existing.customizationRequirements ?? "",
        salesModel: existing.salesModel ?? undefined,
        targetPriceMinCents: existing.targetPriceMinCents !== null ? existing.targetPriceMinCents / 100 : undefined,
        targetPriceMaxCents: existing.targetPriceMaxCents !== null ? existing.targetPriceMaxCents / 100 : undefined,
      }
    : {};

  return (
    <WizardShell
      currentStep="products"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Product strategy</CardTitle>
          <CardDescription>Categories, quantities, and pricing targets.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductsForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
