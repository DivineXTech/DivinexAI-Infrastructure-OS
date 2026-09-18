import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";

export default async function AcademyPage() {
  await requireCurrentTenantRole(STAFF_ROLES);

  return (
    <ComingSoon
      title="Academy"
      description="Training courses and progress tracking."
      phase="Phase 7"
    />
  );
}
