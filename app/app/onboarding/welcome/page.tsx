import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WelcomeContinueButton } from "@/components/onboarding/welcome-continue-button";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { STEPS } from "@/lib/onboarding/steps";
import { requireOnboardingStepAccess } from "@/lib/onboarding/guard";

export default async function WelcomeStepPage() {
  const { session, stepProgress } = await requireOnboardingStepAccess("welcome");

  return (
    <WizardShell
      currentStep="welcome"
      stepProgress={stepProgress}
      completionPercentage={session.completionPercentage}
    >
      <Card>
        <CardHeader>
          <CardTitle>Set up your brand</CardTitle>
          <CardDescription>
            This wizard walks through {STEPS.length} short steps — brand identity, audience, products,
            production, budget, a recommended startup kit, storefront, and fulfillment — then reviews
            everything together with a launch-readiness score. It takes about 15–20 minutes, and you can
            save and come back at any point.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="list-disc pl-5 text-sm text-ink-muted">
            <li>Nothing here commits you to a purchase or a production method.</li>
            <li>You can edit any completed step later from the review page.</li>
            <li>The startup-kit recommendation and launch-readiness score are planning guidance, not guarantees.</li>
          </ul>
          <WelcomeContinueButton />
        </CardContent>
      </Card>
    </WizardShell>
  );
}
