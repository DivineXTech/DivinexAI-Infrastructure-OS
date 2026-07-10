import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/modules/auth/session";

export default async function OnboardingDonePage() {
  const user = await getCurrentUser();
  const wantsToSell = user?.profile?.account_purpose === "sell" || user?.profile?.account_purpose === "both";

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re all set</CardTitle>
        <CardDescription>
          {wantsToSell ? "Publish your first product to get discovered on FlowraMarket." : "Start exploring the marketplace."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {wantsToSell ? (
          <LinkButton href="/dashboard/products/new" className="w-full">
            Create your first product
          </LinkButton>
        ) : null}
        <LinkButton href={wantsToSell ? "/dashboard" : "/discover"} variant="secondary" className="w-full">
          {wantsToSell ? "Go to dashboard" : "Browse the marketplace"}
        </LinkButton>
      </CardContent>
    </Card>
  );
}
