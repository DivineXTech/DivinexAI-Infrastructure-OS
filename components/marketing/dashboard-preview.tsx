import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardPreviewMetrics } from "@/lib/content/homepage";

export function DashboardPreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Operations dashboard"
        title="Run your brand from one operating system"
        description="A single dashboard for launch readiness, orders, production, and growth."
      />
      <div className="mt-10 flex justify-center">
        <Badge variant="outline">Illustrative preview — demo data</Badge>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboardPreviewMetrics.map((metric) => (
          <Card key={metric}>
            <CardHeader className="pb-2">
              <CardDescription>{metric}</CardDescription>
              <CardTitle className="text-xl">—</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-ink-subtle">Demo data</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
