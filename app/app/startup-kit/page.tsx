import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";

export default async function StartupKitPage() {
  await requireCurrentTenantRole(STAFF_ROLES);

  return (
    <ComingSoon
      title="Startup Kit"
      description="Guided startup-kit configuration."
      phase="Phase 7"
    />
  );
}
