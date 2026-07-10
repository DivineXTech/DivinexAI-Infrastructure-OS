import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listActivePlans } from "@/modules/plans/service";
import { formatMinorUnits } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  const configured = isSupabaseConfigured();
  const plans = configured ? await listActivePlans() : [];

  return (
    <Section>
      <Container>
        <div className="text-center">
          <h1 className="font-display text-3xl font-medium text-ink">Simple, transparent pricing</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">
            Every plan shows its transaction fee up front — no surprise deductions at payout.
          </p>
        </div>

        {!configured ? <SupabaseNotConfiguredNotice what="Pricing" /> : null}

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.code} className="flex flex-col">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="font-display text-2xl font-medium text-ink">
                  {plan.monthly_price_minor === 0 ? "Free" : formatMinorUnits(plan.monthly_price_minor, plan.currency_code)}
                  {plan.monthly_price_minor > 0 ? <span className="text-sm font-normal text-ink-muted">/mo</span> : null}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {(plan.default_transaction_fee_bps / 100).toFixed(1)}% transaction fee
                </p>
                <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                  {(plan.features as string[]).map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              </CardContent>
              <div className="p-5 pt-0">
                <LinkButton href="/signup" variant={plan.code === "creator_pro" ? "primary" : "secondary"} className="w-full">
                  {plan.monthly_price_minor === 0 ? "Start free" : "Choose plan"}
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
