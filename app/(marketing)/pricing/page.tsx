import type { Metadata } from "next";

import { FaqSection } from "@/components/marketing/faq-section";
import { PageHeader } from "@/components/marketing/page-header";
import { PricingSection } from "@/components/marketing/pricing-section";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "KushPrintCo OS plans for launching, growing, and scaling your apparel brand, plus white-label licensing.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <PageHeader
        title="Plans that grow with your brand"
        description="No pricing has been finalized yet — every plan is available on request while we validate the platform with early-access founders."
      />
      <PricingSection showHeading={false} />
      <FaqSection />
    </>
  );
}
