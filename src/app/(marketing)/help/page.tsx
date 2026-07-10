import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help" };

const TOPICS = [
  { title: "Buying on FlowraMarket", body: "Browse products, check out securely, and access your purchases from your Library." },
  { title: "Selling on FlowraMarket", body: "Create a storefront, publish a product, and submit it for marketplace review." },
  { title: "Payments & payouts", body: "Understand platform fees and how creator earnings are calculated." },
  { title: "Refunds", body: "Each product lists its own refund policy — request a refund from your order history." },
];

export default function HelpPage() {
  return (
    <Section>
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl font-medium text-ink">Help center</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Need something specific? Email{" "}
          <a className="text-accent-strong hover:underline" href="mailto:support@flowramarket.africa">
            support@flowramarket.africa
          </a>
          .
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TOPICS.map((topic) => (
            <Card key={topic.title}>
              <CardHeader>
                <CardTitle>{topic.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-ink-muted">{topic.body}</CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
