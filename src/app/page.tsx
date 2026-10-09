import { cookies } from "next/headers";
import { HeroSection } from "@/components/marketing/hero-section";
import { AboutSection } from "@/components/marketing/about-section";
import { WaitlistSection } from "@/components/marketing/waitlist-section";
import { PurchaseSection } from "@/components/marketing/purchase-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { ViewTracker } from "@/components/marketing/view-tracker";

export default async function HomePage() {
  const cookieStore = await cookies();
  const referralCode = cookieStore.get("bb_ref")?.value;

  return (
    <>
      <ViewTracker event="landing_view" />
      <HeroSection />
      <AboutSection />
      <WaitlistSection referralCode={referralCode} source="landing" />
      <PurchaseSection />
      <FaqSection />
    </>
  );
}
