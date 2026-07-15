import type { FeatureAvailability } from "@/lib/content/feature-availability";

export type StartupKit = {
  slug: string;
  name: string;
  summary: string;
  includes: string[];
  bestFor: string;
  availability: FeatureAvailability;
};

export const STARTUP_KITS: StartupKit[] = [
  {
    slug: "creator-starter-kit",
    name: "Creator Starter Kit",
    summary:
      "The lowest-cost path to your first physical products, for testing a brand idea before investing in equipment.",
    includes: ["Design software recommendations", "Blank apparel guidance", "Academy: starting a clothing brand"],
    bestFor: "First-time founders validating a concept",
    availability: "early-access",
  },
  {
    slug: "heat-press-business-kit",
    name: "Heat Press Business Kit",
    summary: "A home-studio configuration built around heat-press printing.",
    includes: ["Heat press selection guidance", "Blank apparel", "Consumables", "Setup training"],
    bestFor: "Founders ready to print in-house at small volume",
    availability: "early-access",
  },
  {
    slug: "dtf-launch-kit",
    name: "DTF Launch Kit",
    summary: "Direct-to-film printing configuration for full-color, durable designs.",
    includes: ["DTF printer selection guidance", "Film and powder consumables", "Curing equipment guidance"],
    bestFor: "Brands wanting full-color prints without screens",
    availability: "planned",
  },
  {
    slug: "sublimation-kit",
    name: "Sublimation Kit",
    summary: "All-over-print configuration for polyester and poly-blend garments.",
    includes: ["Sublimation printer guidance", "Heat press guidance", "Blank selection"],
    bestFor: "All-over-print and athletic-wear brands",
    availability: "planned",
  },
  {
    slug: "embroidery-starter-kit",
    name: "Embroidery Starter Kit",
    summary: "Configuration for stitched logos and premium finishing.",
    includes: ["Embroidery machine guidance", "Digitizing resources", "Thread and stabilizer consumables"],
    bestFor: "Premium and workwear-style brands",
    availability: "planned",
  },
  {
    slug: "custom-production-studio",
    name: "Custom Production Studio",
    summary:
      "A tailored, higher-volume configuration built around your specific product mix and production goals.",
    includes: ["Custom equipment plan", "Workspace planning", "Dedicated setup consultation"],
    bestFor: "Operators scaling beyond a single print method",
    availability: "early-access",
  },
];
