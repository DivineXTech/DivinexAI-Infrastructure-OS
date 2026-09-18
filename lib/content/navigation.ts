export type PublicNavItem = { label: string; href: string };

export const PUBLIC_PRIMARY_NAV: PublicNavItem[] = [
  { label: "Platform", href: "/how-it-works" },
  { label: "Startup Kits", href: "/startup-kits" },
  { label: "Equipment", href: "/equipment" },
  { label: "Services", href: "/services" },
  { label: "Academy", href: "/academy" },
  { label: "Pricing", href: "/pricing" },
  { label: "White Label", href: "/white-label" },
];

export const FOOTER_NAV: { heading: string; items: PublicNavItem[] }[] = [
  {
    heading: "Platform",
    items: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "Startup Kits", href: "/startup-kits" },
      { label: "Equipment", href: "/equipment" },
      { label: "Design Studio", href: "/design-studio" },
      { label: "Marketplace", href: "/marketplace" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Services", href: "/services" },
      { label: "White Label", href: "/white-label" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Resources",
    items: [
      { label: "Academy", href: "/academy" },
      { label: "Pricing", href: "/pricing" },
      { label: "Book a Consultation", href: "/book-consultation" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];
