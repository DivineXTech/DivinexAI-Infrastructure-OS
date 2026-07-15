import Link from "next/link";

import { MobileMarketingNav } from "@/components/marketing/mobile-marketing-nav";
import { company } from "@/lib/content/company";
import { PUBLIC_PRIMARY_NAV } from "@/lib/content/navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          {company.legalName} <span className="text-accent">OS</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {PUBLIC_PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-muted hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-sm font-medium text-ink-muted hover:text-ink">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-background hover:bg-ink/90"
          >
            Start Your Brand
          </Link>
        </div>

        <MobileMarketingNav items={PUBLIC_PRIMARY_NAV} />
      </div>
    </header>
  );
}
