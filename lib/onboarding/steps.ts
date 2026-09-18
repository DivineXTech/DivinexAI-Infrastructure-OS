/**
 * Single source of truth for onboarding step order, routes, and copy.
 * Both the wizard shell (progress indicator) and the server-side guard
 * (lib/onboarding/guard.ts) read from this array — there is exactly one
 * place that knows what step comes after what.
 */
export const STEP_KEYS = [
  "welcome",
  "brand",
  "audience",
  "products",
  "production",
  "budget",
  "startup_kit",
  "storefront",
  "fulfillment",
  "review",
] as const;

export type StepKey = (typeof STEP_KEYS)[number];

export type StepMeta = {
  key: StepKey;
  label: string;
  href: string;
  description: string;
};

export const STEPS: StepMeta[] = [
  {
    key: "welcome",
    label: "Welcome",
    href: "/app/onboarding/welcome",
    description: "What onboarding will configure and how long it takes.",
  },
  {
    key: "brand",
    label: "Brand Identity",
    href: "/app/onboarding/brand",
    description: "Name, colors, typography, and personality.",
  },
  {
    key: "audience",
    label: "Audience",
    href: "/app/onboarding/audience",
    description: "Who you're building this brand for.",
  },
  {
    key: "products",
    label: "Product Strategy",
    href: "/app/onboarding/products",
    description: "Categories, quantities, and pricing targets.",
  },
  {
    key: "production",
    label: "Production Method",
    href: "/app/onboarding/production",
    description: "How you'll produce your products.",
  },
  {
    key: "budget",
    label: "Budget",
    href: "/app/onboarding/budget",
    description: "Planning guidance, not a financial commitment.",
  },
  {
    key: "startup_kit",
    label: "Startup Kit",
    href: "/app/onboarding/startup-kit",
    description: "A recommended configuration based on your answers.",
  },
  {
    key: "storefront",
    label: "Storefront",
    href: "/app/onboarding/storefront",
    description: "How customers will find and buy from you.",
  },
  {
    key: "fulfillment",
    label: "Fulfillment",
    href: "/app/onboarding/fulfillment",
    description: "How orders get produced, packaged, and shipped.",
  },
  {
    key: "review",
    label: "Review",
    href: "/app/onboarding/review",
    description: "Confirm everything before launch.",
  },
];

export function stepIndex(key: StepKey): number {
  return STEP_KEYS.indexOf(key);
}

export function nextStep(key: StepKey): StepMeta | null {
  const index = stepIndex(key);
  return STEPS[index + 1] ?? null;
}

export function stepMeta(key: StepKey): StepMeta {
  const meta = STEPS.find((s) => s.key === key);
  if (!meta) throw new Error(`Unknown onboarding step: ${key}`);
  return meta;
}
