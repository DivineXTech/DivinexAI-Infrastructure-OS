import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";

export default async function SuppliersPage() {
  await requireCurrentTenantRole(STAFF_ROLES);

  return (
    <ComingSoon
      title="Suppliers"
      description="Supplier records and sourcing."
      phase="Phase 7"
    />
  );
}
