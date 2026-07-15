/**
 * Central source of truth for company/brand copy used across the public
 * site. Keeps business copy out of components — edit this file, not JSX,
 * when the marketing team changes contact info, leadership, or links.
 */

export const company = {
  name: "KushPrintCo OS",
  legalName: "KushPrintCo",
  tagline: "Launch Your Clothing Brand. We Supply Everything.",
  poweredBy: "DivinexAI",
  poweredByDescription:
    "KushPrintCo OS is powered by the DivinexAI ecosystem — shared infrastructure for AI agents, payments, authentication, workflow orchestration, and analytics across DivinexAI's vertical business operating systems.",
} as const;

export const leadership = [
  { name: "Mr. Jonathan", title: "CEO, KushPrintCo" },
  { name: "Robert L. McCormick", title: "Co-CEO and DivinexAI Ecosystem Lead" },
] as const;

export const contact = {
  // Placeholders — swap for real values before public launch (see
  // docs/DEPLOYMENT.md "First real-environment checklist").
  email: "hello@kushprintco.example",
  supportEmail: "support@kushprintco.example",
  phone: null as string | null,
  address: null as string | null,
} as const;

export const socialLinks = [
  // Left empty deliberately: no real social accounts exist yet to link to
  // honestly. Populate once accounts are live rather than linking
  // placeholders that look real.
] as const satisfies readonly { label: string; href: string }[];
