import { ComingSoon } from "@/components/app-shell/coming-soon";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";

export default async function SupportPage() {
  await requireCurrentTenantRole(STAFF_ROLES);

  return (
    <ComingSoon
      title="Support"
      description="Support tickets and help resources."
      phase="a later phase"
    />
  );
}
