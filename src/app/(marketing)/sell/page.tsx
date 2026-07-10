import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = { title: "Sell on FlowraMarket Africa" };

const STEPS = [
  { title: "Create your storefront", description: "Pick a store name, add your logo, and tell buyers what you do." },
  { title: "Publish your first product", description: "Digital files, courses, services, memberships, and bundles — priced your way." },
  { title: "Get paid", description: "Local African payment rails and global cards, with clear, configurable fees." },
];

const AUDIENCES = [
  "Digital creators & designers",
  "Video editors & musicians",
  "Course creators & educators",
  "AI-agent & software developers",
  "Consultants, coaches & agencies",
  "Local businesses & studios",
];

export default function SellPage() {
  return (
    <Section>
      <Container className="text-center">
        <h1 className="mx-auto max-w-2xl font-display text-4xl font-medium text-ink">
          Turn African creativity, expertise, and innovation into global income.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">
          FlowraMarket Africa gives creators, developers, educators, and businesses a storefront, checkout, and
          fulfillment system built for how Africa sells online.
        </p>
        <LinkButton href="/signup" size="lg" className="mt-6">
          Start selling free
        </LinkButton>

        <div className="mt-16 grid gap-6 text-left sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Card key={step.title}>
              <CardHeader>
                <span className="text-xs font-semibold text-accent-strong">STEP {i + 1}</span>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-left">
          <h2 className="font-display text-xl font-medium text-ink">Built for</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <div key={audience} className="rounded-md border border-border bg-surface p-4 text-sm text-ink">
                {audience}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
