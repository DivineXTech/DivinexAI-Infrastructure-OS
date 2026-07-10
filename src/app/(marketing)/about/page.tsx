import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <Section>
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl font-medium text-ink">About FlowraMarket Africa</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink-muted">
          <p>
            FlowraMarket Africa is a creator commerce marketplace built by Divinex Technology LLC. It gives African
            creators, developers, educators, agencies, and local businesses a storefront, checkout, and fulfillment
            system for selling digital products, courses, services, and memberships to buyers across Africa, the
            diaspora, and the world.
          </p>
          <p>
            FlowraMarket Africa is part of a wider operating system for creator and business commerce: Sara Build
            Studio creates, MediaForgeOS promotes, FlowraMarket distributes, FlowraPay processes, AgentFlow Pro
            fulfills, and DivinexAI governs.
          </p>
          <p>
            The platform is under active development. Payment methods, supported countries, and features are added
            in phases — see the <a className="text-accent-strong hover:underline" href="/trust">Trust &amp; Safety</a> page
            for what is live today.
          </p>
        </div>
      </Container>
    </Section>
  );
}
