import Link from "next/link";
import { Container } from "@/components/ui/container";

const FOOTER_SECTIONS = [
  {
    title: "Marketplace",
    links: [
      { href: "/discover", label: "Discover" },
      { href: "/creators", label: "Creators" },
      { href: "/category/ai-agents", label: "AI Agents" },
      { href: "/category/online-courses", label: "Courses" },
    ],
  },
  {
    title: "Sell",
    links: [
      { href: "/sell", label: "Start selling" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/trust", label: "Trust & Safety" },
      { href: "/help", label: "Help" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/refunds", label: "Refund Policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-paper-muted">
      <Container className="grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
        {FOOTER_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-sm font-semibold text-ink">{section.title}</p>
            <ul className="mt-3 space-y-2">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-ink-muted hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <Container className="border-t border-border py-6 text-xs text-ink-muted">
        <p>&copy; {new Date().getFullYear()} FlowraMarket Africa, a Divinex Technology LLC product. Create it. Sell it. Scale it.</p>
      </Container>
    </footer>
  );
}
