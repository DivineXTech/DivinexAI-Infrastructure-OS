import type { FeatureAvailability } from "@/lib/content/feature-availability";

export type Service = {
  slug: string;
  name: string;
  description: string;
  availability: FeatureAvailability;
};

export const SERVICES: Service[] = [
  {
    slug: "brand-identity-setup",
    name: "Brand Identity Setup",
    description: "Guidance defining your brand name, colors, and positioning.",
    availability: "early-access",
  },
  {
    slug: "garment-product-planning",
    name: "Garment and Product Planning",
    description: "Choosing the right product categories and garment types for your audience.",
    availability: "early-access",
  },
  {
    slug: "artwork-preparation",
    name: "Artwork Preparation",
    description: "Preparing print-ready artwork for your chosen production method.",
    availability: "planned",
  },
  {
    slug: "startup-kit-consultation",
    name: "Startup-Kit Consultation",
    description: "A guided conversation to match equipment and kit choices to your budget and goals.",
    availability: "available",
  },
  {
    slug: "equipment-selection",
    name: "Equipment Selection",
    description: "Recommendations across heat press, DTF, sublimation, embroidery, and screen printing.",
    availability: "available",
  },
  {
    slug: "storefront-setup",
    name: "Storefront Setup",
    description: "Configuring your branded storefront once the design studio and commerce tools ship.",
    availability: "planned",
  },
  {
    slug: "production-workflow-design",
    name: "Production Workflow Design",
    description: "Designing an order-to-shipment workflow for your production method and volume.",
    availability: "planned",
  },
  {
    slug: "business-launch-planning",
    name: "Business Launch Planning",
    description: "Planning your launch timeline across brand, product, and operations readiness.",
    availability: "available",
  },
  {
    slug: "white-label-licensing",
    name: "White-Label Platform Licensing",
    description: "Deploying a branded version of the operating system for consultants, print shops, and agencies.",
    availability: "early-access",
  },
];
