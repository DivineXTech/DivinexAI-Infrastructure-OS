import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listDesignProjects } from "@/lib/design-studio/data-access";
import { requireDesignReadAccess } from "@/lib/design-studio/guard";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  needs_artwork: "Needs artwork",
  ready_for_review: "Ready for review",
  changes_requested: "Changes requested",
  approved: "Approved",
  converted_to_product: "Converted to product",
  archived: "Archived",
};

export default async function DesignStudioListPage() {
  const { membership } = await requireDesignReadAccess();
  const projects = await listDesignProjects(membership.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Design Studio</h1>
          <p className="text-sm text-ink-muted">Garment design projects and their review status.</p>
        </div>
        <Button asChild>
          <Link href="/app/design-studio/new">New design</Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-ink-muted">No design projects yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/app/design-studio/${project.id}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant="outline">{STATUS_LABELS[project.status]}</Badge>
                  </div>
                  <CardDescription>
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-ink-subtle">
                    {project.productionMethod ? project.productionMethod.replace(/_/g, " ") : "No production method set"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
