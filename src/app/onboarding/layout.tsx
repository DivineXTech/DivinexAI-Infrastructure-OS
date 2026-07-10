import Link from "next/link";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-muted">
      <header className="border-b border-border bg-paper">
        <Container className="flex h-16 items-center">
          <Link href="/" className="font-display text-lg font-semibold text-ink">
            FlowraMarket <span className="text-accent-strong">Africa</span>
          </Link>
        </Container>
      </header>
      <Container className="max-w-xl py-12">{children}</Container>
    </div>
  );
}
