import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { LinkButton } from "@/components/ui/button";
import { requireUser } from "@/modules/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LibraryPurchasesPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: entitlements } = await supabase
    .from("entitlements")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  if (!entitlements || entitlements.length === 0) {
    return (
      <EmptyState
        title="No purchases yet"
        description="Products you buy on FlowraMarket appear here with instant, secure access."
        action={<LinkButton href="/discover">Browse the marketplace</LinkButton>}
      />
    );
  }

  const productIds = entitlements.map((e) => e.product_id);
  const [{ data: products }, { data: files }] = await Promise.all([
    supabase.from("products").select("id, title, slug, product_type").in("id", productIds),
    supabase.from("product_files").select("id, product_id, file_name").in("product_id", productIds),
  ]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const filesByProduct = new Map<string, { id: string; file_name: string }[]>();
  for (const file of files ?? []) {
    const list = filesByProduct.get(file.product_id) ?? [];
    list.push(file);
    filesByProduct.set(file.product_id, list);
  }

  return (
    <div className="space-y-4">
      {entitlements.map((entitlement) => {
        const product = productById.get(entitlement.product_id);
        const productFiles = filesByProduct.get(entitlement.product_id) ?? [];
        return (
          <div key={entitlement.id} className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/product/${product?.slug}`} className="font-medium text-ink hover:text-accent-strong">
                  {product?.title ?? "Product"}
                </Link>
                <p className="text-xs text-ink-muted">
                  {entitlement.downloads_used} download{entitlement.downloads_used === 1 ? "" : "s"} used
                </p>
              </div>
              <StatusBadge status={entitlement.status} />
            </div>

            {productFiles.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {productFiles.map((file) => (
                  <li key={file.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">{file.file_name}</span>
                    <a
                      href={`/download/${entitlement.id}/${file.id}`}
                      className="font-medium text-accent-strong hover:underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">No downloadable files for this product.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
