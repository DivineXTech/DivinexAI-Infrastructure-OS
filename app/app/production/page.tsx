import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";

export default async function ProductionPage() {
  await requireCurrentTenantRole(STAFF_ROLES);

  return (
    <ComingSoon
      title="Production"
      description="Production job board and quality control."
      phase="Phase 6"
    />
  );
}
