/**
 * No approved pricing numbers exist yet, so every plan below is priced as
 * "Request pricing" rather than a fabricated dollar figure — this
 * structure is what a future approved-pricing update fills in
 * (`startingAtCents`), not something components should invent values for.
 * Keep pricing data-driven here rather than hardcoded into JSX so that
 * update is a one-file change.
 */
export type PricingPlan = {
  slug: string;
  name: string;
  description: string;
  /** Null until real pricing is approved — components must render the
   * "Request pricing" state whenever this is null, never a placeholder
   * number. */
  startingAtCents: number | null;
  billingPeriod: "month" | "one-time" | null;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    slug: "launch",
    name: "Launch",
    description: "For founders starting their first clothing brand.",
    startingAtCents: null,
    billingPeriod: null,
    features: [
      "Brand workspace",
      "Startup-kit recommendation",
      "Academy access",
      "Storefront (coming in a later phase)",
    ],
    cta: { label: "Start Your Brand", href: "/signup" },
  },
  {
    slug: "growth",
    name: "Growth",
    description: "For brands ready to scale product count and order volume.",
    startingAtCents: null,
    billingPeriod: null,
    features: [
      "Everything in Launch",
      "Expanded product catalog",
      "Marketing tools (coming in a later phase)",
      "Priority support",
    ],
    cta: { label: "Request Pricing", href: "/book-consultation" },
    highlighted: true,
  },
  {
    slug: "production",
    name: "Production",
    description: "For operators running in-house production at meaningful volume.",
    startingAtCents: null,
    billingPeriod: null,
    features: [
      "Everything in Growth",
      "Production workflow tools (coming in a later phase)",
      "Equipment and supplier support",
      "Dedicated onboarding consultation",
    ],
    cta: { label: "Request Pricing", href: "/book-consultation" },
  },
  {
    slug: "white-label",
    name: "White Label",
    description: "For consultants, print shops, and agencies deploying their own branded platform.",
    startingAtCents: null,
    billingPeriod: null,
    features: [
      "Branded, licensed platform deployment",
      "Custom feature entitlements",
      "Marketplace commission structure",
      "Dedicated partner support",
    ],
    cta: { label: "Become a Partner", href: "/white-label" },
  },
];

export const CUSTOM_QUOTE_PLAN = {
  name: "Custom Quote",
  description: "Have unique requirements? Tell us about your business and we'll put together a plan.",
  cta: { label: "Request Custom Quote", href: "/book-consultation" },
};
