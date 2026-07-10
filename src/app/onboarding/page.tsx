import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";

const STEP_ROUTES: Record<string, string> = {
  purpose: "/onboarding/purpose",
  profile: "/onboarding/profile",
  store: "/onboarding/store",
  payment: "/onboarding/payment",
  completed: "/onboarding/done",
};

export default async function OnboardingIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect_to=/onboarding");

  const step = user.profile?.onboarding_step ?? "purpose";
  redirect(STEP_ROUTES[step] ?? "/onboarding/purpose");
}
