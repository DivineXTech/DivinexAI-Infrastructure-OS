import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Check your inbox" description="We sent a confirmation link to finish creating your account.">
      <p className="text-sm text-ink-muted">
        Once you confirm your email, sign in to continue to onboarding.
      </p>
      <Link href="/login" className="mt-4 block text-center text-sm font-medium text-accent-strong hover:underline">
        Go to sign in
      </Link>
    </AuthCard>
  );
}
