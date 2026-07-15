import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireCurrentTenantRole } from "@/lib/auth/session";
import { STAFF_ROLES } from "@/lib/auth/roles";

const METRICS = [
  "Total sales",
  "Total orders",
  "Orders awaiting production",
  "Orders in production",
  "Orders ready to ship",
  "Inventory alerts",
  "Storefront traffic",
  "Conversion rate",
  "Average order value",
] as const;

export default async function DashboardPage() {
  const membership = await requireCurrentTenantRole(STAFF_ROLES);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{membership.tenantName}</h1>
        <p className="text-sm text-ink-muted">
          Launch readiness and operations at a glance.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Launch readiness</CardTitle>
          <CardDescription>
            Onboarding completion and recommended next actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-muted">
            Onboarding hasn&apos;t started yet. This will populate once the
            onboarding wizard (Phase 3) is built.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((metric) => (
          <Card key={metric}>
            <CardHeader className="pb-2">
              <CardDescription>{metric}</CardDescription>
              <CardTitle className="text-2xl">—</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">No data yet</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-subtle">
        In development/demo mode, seeded metrics will be clearly labeled
        &ldquo;Demo data&rdquo; rather than shown as live figures.
      </p>
    </div>
  );
}
