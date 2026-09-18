import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMockups } from "@/lib/design-studio/data-access";
import { requireDesignReadAccess } from "@/lib/design-studio/guard";

export default async function MockupsPage() {
  const { membership } = await requireDesignReadAccess();
  const mockups = await listMockups(membership.tenantId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Mockups</h1>
        <p className="text-sm text-ink-muted">
          Browser-generated digital previews — not final production proofs.
        </p>
      </div>

      {mockups.length === 0 ? (
        <p className="text-sm text-ink-muted">No mockups generated yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockups.map((mockup) => (
            <Link key={mockup.id} href={`/app/mockups/${mockup.id}`}>
              <Card className="h-full transition-colors hover:border-accent">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{mockup.views.length} view(s)</CardTitle>
                    {mockup.hasWatermark ? <Badge variant="outline">Watermarked</Badge> : null}
                  </div>
                  <CardDescription>{new Date(mockup.createdAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-ink-subtle">Digital preview, not a production proof.</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
