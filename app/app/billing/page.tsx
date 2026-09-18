import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { TENANT_ADMIN_ROLES } from "@/lib/auth/roles";

export default async function BillingPage() {
  await requireCurrentTenantRole(TENANT_ADMIN_ROLES);

  return (
    <ComingSoon
      title="Billing"
      description="Subscription plan and billing management."
      phase="Phase 8"
    />
  );
}
