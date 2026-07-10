import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Trust & Safety" };

const PAYMENT_METHODS = [
  { name: "Mock / test checkout", status: "Active in development", tone: "success" as const },
  { name: "Stripe (cards, global)", status: "Planned — Phase 2", tone: "neutral" as const },
  { name: "Paystack (Nigeria, Ghana)", status: "Planned — Phase 2", tone: "neutral" as const },
  { name: "Flutterwave (pan-African)", status: "Planned — Phase 2", tone: "neutral" as const },
  { name: "M-Pesa, MTN & Airtel Money", status: "Planned — Phase 4", tone: "neutral" as const },
];

export default function TrustPage() {
  return (
    <Section>
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl font-medium text-ink">Trust &amp; Safety</h1>
        <p className="mt-4 text-sm text-ink-muted">
          FlowraMarket Africa protects buyers and creators with server-side price calculation, entitlement-gated
          downloads, seller verification, and platform moderation on every published product. We are transparent
          about what is fully live versus in progress.
        </p>

        <h2 className="mt-8 font-display text-lg font-medium text-ink">Payment methods</h2>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {PAYMENT_METHODS.map((method) => (
            <li key={method.name} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-ink">{method.name}</span>
              <Badge tone={method.tone}>{method.status}</Badge>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 font-display text-lg font-medium text-ink">How purchases are protected</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-muted">
          <li>Prices are calculated on the server at checkout — never trusted from the browser.</li>
          <li>Digital files are stored privately and only ever released via a short-lived, entitlement-checked link.</li>
          <li>Every product is reviewed before it appears in marketplace search and discovery.</li>
          <li>Material admin and payment actions are recorded in an internal audit log.</li>
        </ul>
      </Container>
    </Section>
  );
}
