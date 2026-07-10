import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { formatMinorUnits, formatDate } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveProductAction, rejectProductAction } from "@/modules/admin/actions";

export default async function AdminModerationPage() {
  const supabase = await createSupabaseServerClient();
  const { data: submissions } = await supabase
    .from("product_submissions")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at");

  if (!submissions || submissions.length === 0) {
    return (
      <div>
        <h1 className="mb-6 font-display text-2xl font-medium text-ink">Moderation</h1>
        <EmptyState title="No products awaiting review" />
      </div>
    );
  }

  const productIds = submissions.map((s) => s.product_id);
  const { data: products } = await supabase.from("products").select("*").in("id", productIds);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Moderation</h1>
      <div className="space-y-4">
        {submissions.map((submission) => {
          const product = productById.get(submission.product_id);
          if (!product) return null;
          return (
            <Card key={submission.id}>
              <CardHeader>
                <CardTitle>{product.title}</CardTitle>
                <CardDescription>
                  Submitted {formatDate(submission.submitted_at)} ·{" "}
                  {product.pricing_model === "free" ? "Free" : formatMinorUnits(product.base_price_minor, product.currency_code)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-ink-muted">{product.short_description || product.full_description}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <form action={approveProductAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <Button type="submit">Approve</Button>
                  </form>
                  <form action={rejectProductAction} className="flex flex-1 items-center gap-2">
                    <input type="hidden" name="productId" value={product.id} />
                    <Textarea name="reason" required minLength={3} placeholder="Reason for rejection" className="min-h-10 flex-1" rows={1} />
                    <Button type="submit" variant="danger">
                      Reject
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
