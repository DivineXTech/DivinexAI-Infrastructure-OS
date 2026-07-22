import { cookies } from "next/headers";
import { HeroSection } from "@/components/marketing/hero-section";
import { AboutSection } from "@/components/marketing/about-section";
import { WaitlistSection } from "@/components/marketing/waitlist-section";
import { FaqSection } from "@/components/marketing/faq-section";

export default async function HomePage() {
  const cookieStore = await cookies();
  const referralCode = cookieStore.get("bb_ref")?.value;

  return (
    <>
      <HeroSection />
      <AboutSection />
      <WaitlistSection referralCode={referralCode} source="landing" />
      <FaqSection />
    </>
  );
}
