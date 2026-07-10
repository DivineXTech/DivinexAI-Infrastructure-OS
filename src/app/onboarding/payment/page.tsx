import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/ui/states";
import { completeOnboardingPayment } from "@/modules/onboarding/actions";

export default function OnboardingPaymentPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments &amp; payouts</CardTitle>
        <CardDescription>Connect how you&apos;ll get paid.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium text-ink">Mock checkout (development)</p>
            <p className="text-xs text-ink-muted">Active — used for testing the full purchase flow.</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-4 opacity-70">
          <div>
            <p className="text-sm font-medium text-ink">Stripe, Paystack &amp; Flutterwave</p>
            <p className="text-xs text-ink-muted">Real payouts to your bank or mobile money account.</p>
          </div>
          <ComingSoon />
        </div>
        <form action={completeOnboardingPayment}>
          <Button type="submit" className="w-full">
            Finish setup
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
