import { redirect } from "next/navigation";

import { CreateTenantForm } from "@/components/onboarding/create-tenant-form";
import { getCurrentProfile, listMyTenantMemberships } from "@/lib/auth/session";

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const memberships = await listMyTenantMemberships();
  if (memberships.length > 0) redirect("/app");

  return <CreateTenantForm />;
}
