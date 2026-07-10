import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";

export const dynamic = "force-static";

const LEGAL_DOCUMENTS: Record<string, { title: string; summary: string }> = {
  terms: {
    title: "Terms of Service",
    summary: "Governs use of FlowraMarket Africa by buyers and creators.",
  },
  privacy: {
    title: "Privacy Policy",
    summary: "Explains what data FlowraMarket Africa collects and how it is used.",
  },
  refunds: {
    title: "Platform Refund Policy",
    summary: "The platform-wide baseline refund policy; individual products may offer additional protection.",
  },
  "creator-agreement": {
    title: "Creator Agreement",
    summary: "Terms creators accept to sell on FlowraMarket Africa, including payout and content rules.",
  },
  "buyer-terms": {
    title: "Buyer Terms",
    summary: "Terms buyers accept when purchasing on FlowraMarket Africa.",
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    summary: "Prohibited content and conduct on the marketplace.",
  },
  copyright: {
    title: "Copyright Complaint Process",
    summary: "How to report a copyright infringement claim against a listed product.",
  },
};

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((document) => ({ document }));
}

export async function generateMetadata({ params }: { params: Promise<{ document: string }> }): Promise<Metadata> {
  const { document } = await params;
  return { title: LEGAL_DOCUMENTS[document]?.title ?? "Legal" };
}

export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  const doc = LEGAL_DOCUMENTS[document];
  if (!doc) notFound();

  return (
    <Section>
      <Container className="max-w-3xl">
        <h1 className="font-display text-3xl font-medium text-ink">{doc.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{doc.summary}</p>
        <div className="mt-6 rounded-lg border border-warning-soft bg-warning-soft p-4 text-sm text-warning">
          This page is placeholder content generated for the FlowraMarket Africa MVP. It is not legal advice and has
          not been reviewed by counsel — see COMPLIANCE_NOTES.md for what legal review this document still needs
          before go-live.
        </div>
      </Container>
    </Section>
  );
}
