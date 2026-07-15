export const announcement = {
  message: "Now accepting early-access apparel founders and white-label partners.",
  href: "/signup",
};

export const hero = {
  headline: "Launch Your Clothing Brand. We Supply Everything.",
  subheadline:
    "From your first idea to products, equipment, production, storefront, and growth — KushPrintCo OS gives you one operating system for building an apparel business.",
  primaryCta: { label: "Start Your Brand", href: "/signup" },
  secondaryCta: { label: "Explore Startup Kits", href: "/startup-kits" },
  tertiaryCta: { label: "Book a Consultation", href: "/book-consultation" },
};

export const trustStrip = [
  "Brand Setup",
  "Product Design",
  "Startup Equipment",
  "Production Workflow",
  "Storefront Tools",
  "Training and Support",
] as const;

export const howItWorks = [
  {
    step: 1,
    title: "Define your brand",
    description:
      "Name your brand, choose your colors, and describe who you're building for.",
  },
  {
    step: 2,
    title: "Choose your products",
    description:
      "Pick the garment types and categories your first collection will include.",
  },
  {
    step: 3,
    title: "Select your production method",
    description:
      "Compare heat press, DTF, sublimation, embroidery, and screen printing to find the right fit.",
  },
  {
    step: 4,
    title: "Build your startup kit",
    description:
      "Get a configuration of equipment, blanks, consumables, and training matched to your budget and goals.",
  },
  {
    step: 5,
    title: "Launch your storefront",
    description: "Configure your branded storefront and start taking orders.",
  },
  {
    step: 6,
    title: "Grow with training and automation",
    description:
      "Use the Academy and marketing tools to develop pricing, fulfillment, and growth skills as you scale.",
  },
] as const;

export const finalCta = {
  headline: "Your Clothing Brand Needs More Than a Logo. It Needs an Operating System.",
  primaryCta: { label: "Start Your Brand", href: "/signup" },
  secondaryCta: { label: "Book a Consultation", href: "/book-consultation" },
};

export const dashboardPreviewMetrics = [
  "Launch-readiness score",
  "Current orders",
  "Production queue",
  "Inventory alerts",
  "Storefront activity",
  "Training progress",
  "Recommended actions",
] as const;
