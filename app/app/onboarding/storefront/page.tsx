import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StorefrontForm } from "@/components/onboarding/storefront-form";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { getStorefrontPreferences } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";
import type { StorefrontStepInput } from "@/lib/validation/onboarding";

export default async function StorefrontStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("storefront");
  const existing = await getStorefrontPreferences(session.tenantId);

  const defaultValues: Partial<StorefrontStepInput> = existing
    ? {
        storefrontName: existing.storefrontName ?? "",
        themeDirection: existing.themeDirection ?? "",
        heroMessaging: existing.heroMessaging ?? "",
        featuredCategories: existing.featuredCategories,
        domainStatus: existing.domainStatus ?? undefined,
        existingDomain: existing.existingDomain ?? "",
        contactChannel: existing.contactChannel ?? "",
        announcementBarText: existing.announcementBarText ?? "",
        fulfillmentOffer: existing.fulfillmentOffer ?? undefined,
        plannedPaymentMethods: existing.plannedPaymentMethods as StorefrontStepInput["plannedPaymentMethods"],
      }
    : {};

  return (
    <WizardShell
      currentStep="storefront"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Storefront preferences</CardTitle>
          <CardDescription>How customers will find and buy from you.</CardDescription>
        </CardHeader>
        <CardContent>
          <StorefrontForm defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
