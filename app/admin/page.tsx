import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const METRICS = [
  "Active tenants",
  "Total platform users",
  "Open support tickets",
  "System health",
] as const;

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Platform overview</h1>
        <p className="text-sm text-ink-muted">
          Cross-tenant platform health and administration.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
    </div>
  );
}
