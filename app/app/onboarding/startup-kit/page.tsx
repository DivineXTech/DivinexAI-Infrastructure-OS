import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StartupKitPanel } from "@/components/onboarding/startup-kit-panel";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { STARTUP_KITS } from "@/lib/content/startup-kits";
import { getStartupKitRecommendation } from "@/lib/onboarding/data-access";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";

export default async function StartupKitStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("startup_kit");
  const recommendation = await getStartupKitRecommendation(session.tenantId);

  return (
    <WizardShell
      currentStep="startup_kit"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Startup kit recommendation</CardTitle>
          <CardDescription>A recommended configuration based on your answers so far.</CardDescription>
        </CardHeader>
        <CardContent>
          <StartupKitPanel recommendation={recommendation} kits={STARTUP_KITS} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
