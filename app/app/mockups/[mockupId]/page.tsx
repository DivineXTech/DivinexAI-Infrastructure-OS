import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintButton } from "@/components/design-studio/print-button";
import { getMockup } from "@/lib/design-studio/data-access";
import { requireDesignReadAccess } from "@/lib/design-studio/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MockupDetailPage({
  params,
}: {
  params: Promise<{ mockupId: string }>;
}) {
  const { mockupId } = await params;
  const { membership } = await requireDesignReadAccess();
  const mockup = await getMockup(membership.tenantId, mockupId);
  if (!mockup) notFound();

  const supabase = await createSupabaseServerClient();
  const views = await Promise.all(
    mockup.views.map(async (view) => {
      const { data } = await supabase.storage.from("design-uploads").createSignedUrl(view.imagePath, 60 * 10);
      return { viewKey: view.viewKey, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="flex flex-col gap-6 print:gap-3">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Mockup</h1>
          <p className="text-sm text-ink-muted">{new Date(mockup.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          {mockup.hasWatermark ? <Badge variant="outline">Watermarked</Badge> : null}
          <PrintButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Digital preview</CardTitle>
          <CardDescription>
            This is a browser-generated preview, not a final production proof. Manual production review is
            recommended before manufacturing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {views.map((view) =>
            view.url ? (
              <div key={view.viewKey} className="flex flex-col gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={view.url} alt={`${view.viewKey} mockup`} className="w-full rounded-md border border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm capitalize text-ink-muted">{view.viewKey}</span>
                  <a href={view.url} download className="text-sm text-accent underline-offset-4 hover:underline">
                    Download
                  </a>
                </div>
              </div>
            ) : null,
          )}
        </CardContent>
      </Card>
    </div>
  );
}
