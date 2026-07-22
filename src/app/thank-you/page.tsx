import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SuccessPanel } from "@/components/marketing/success-panel";

export const metadata: Metadata = {
  title: "You're In",
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; ref?: string; token?: string }>;
}) {
  const params = await searchParams;

  if (!params.name || !params.ref || !params.token) {
    redirect("/join");
  }

  return (
    <SuccessPanel
      firstName={params.name}
      referralCode={params.ref}
      chapter12Href={`/chapter-12?token=${params.token}`}
    />
  );
}
