import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const NAV_LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/creators", label: "Creators" },
  { href: "/pricing", label: "Pricing" },
  { href: "/sell", label: "Sell" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
          FlowraMarket <span className="text-accent-strong">Africa</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-ink-muted hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </LinkButton>
          <LinkButton href="/signup" size="sm">
            Start selling
          </LinkButton>
        </div>
      </Container>
    </header>
  );
}
