import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" description="Welcome back to FlowraMarket Africa.">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-accent-strong hover:underline">
          Create one
        </Link>
      </p>
      <p className="mt-2 text-center text-sm">
        <Link href="/forgot-password" className="text-ink-muted hover:underline">
          Forgot your password?
        </Link>
      </p>
    </AuthCard>
  );
}
