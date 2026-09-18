import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { TENANT_ADMIN_ROLES } from "@/lib/auth/roles";

export default async function TeamPage() {
  await requireCurrentTenantRole(TENANT_ADMIN_ROLES);

  return (
    <ComingSoon
      title="Team"
      description="Team members and role management."
      phase="Phase 8"
    />
  );
}
