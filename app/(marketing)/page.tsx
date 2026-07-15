import type { Metadata } from "next";

import { AcademySection } from "@/components/marketing/academy-section";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { EquipmentEcosystem } from "@/components/marketing/equipment-ecosystem";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ServicesSection } from "@/components/marketing/services-section";
import { StartupKitPreview } from "@/components/marketing/startup-kit-preview";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { WhiteLabelSection } from "@/components/marketing/white-label-section";

export const metadata: Metadata = {
  title: "KushPrintCo OS — Launch Your Clothing Brand",
  description:
    "KushPrintCo OS is the apparel business operating system: brand development, apparel design, equipment, production, storefront, and training in one platform.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <StartupKitPreview />
      <EquipmentEcosystem />
      <ServicesSection />
      <DashboardPreview />
      <AcademySection />
      <WhiteLabelSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </>
  );
}
