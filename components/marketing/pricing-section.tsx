import Link from "next/link";
import { Check } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CUSTOM_QUOTE_PLAN, PRICING_PLANS } from "@/lib/content/pricing";
import { cn } from "@/lib/utils";

export function PricingSection({ showHeading = true }: { showHeading?: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      {showHeading ? (
        <SectionHeading
          eyebrow="Pricing"
          title="Plans that grow with your brand"
          description="No pricing has been finalized yet — every plan below is available on request while we validate the platform with early-access founders."
        />
      ) : null}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_PLANS.map((plan) => (
          <Card
            key={plan.slug}
            className={cn("flex flex-col", plan.highlighted && "border-accent")}
          >
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-4">
              <p className="text-2xl font-semibold text-ink">
                {plan.startingAtCents === null
                  ? "Request pricing"
                  : `$${(plan.startingAtCents / 100).toFixed(0)}${
                      plan.billingPeriod === "month" ? "/mo" : ""
                    }`}
              </p>
              <ul className="flex flex-col gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-ink-muted">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild variant={plan.highlighted ? "default" : "outline"} className="mt-2">
                <Link href={plan.cta.href}>{plan.cta.label}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-ink-muted">{CUSTOM_QUOTE_PLAN.description}</p>
        <Button asChild variant="link">
          <Link href={CUSTOM_QUOTE_PLAN.cta.href}>{CUSTOM_QUOTE_PLAN.cta.label}</Link>
        </Button>
      </div>
    </section>
  );
}
