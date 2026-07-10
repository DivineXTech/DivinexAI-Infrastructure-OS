import Link from "next/link";
import { Container } from "@/components/ui/container";

const TABS = [
  { href: "/library/purchases", label: "Purchases" },
  { href: "/library/saved", label: "Saved" },
];

export const dynamic = "force-dynamic";

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-muted">
      <header className="border-b border-border bg-paper">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-lg font-semibold text-ink">
            FlowraMarket <span className="text-accent-strong">Africa</span>
          </Link>
          <Link href="/account" className="text-sm text-ink-muted hover:text-ink">
            Account
          </Link>
        </Container>
      </header>
      <Container className="py-8">
        <nav className="mb-6 flex gap-4 border-b border-border">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-ink-muted hover:text-ink">
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </Container>
    </div>
  );
}
