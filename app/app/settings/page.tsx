import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { TENANT_ADMIN_ROLES } from "@/lib/auth/roles";

export default async function SettingsPage() {
  await requireCurrentTenantRole(TENANT_ADMIN_ROLES);

  return (
    <ComingSoon
      title="Settings"
      description="Tenant configuration and preferences."
      phase="Phase 8"
    />
  );
}
