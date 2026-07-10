import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProductFileUploader } from "@/components/dashboard/product-file-uploader";
import { ProductMediaUploader } from "@/components/dashboard/product-media-uploader";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProductAction, submitProductForReviewAction } from "@/modules/products/actions";
import { formatMinorUnits } from "@/lib/utils";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: product }, { data: categories }, { data: files }, { data: media }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("creator_id", membership.creator.id).maybeSingle(),
    supabase.from("product_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("product_files").select("*").eq("product_id", id).order("sort_order"),
    supabase.from("product_media").select("*").eq("product_id", id).order("sort_order"),
  ]);

  if (!product) notFound();

  const cover = media?.find((m) => m.media_type === "cover");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">{product.title}</h1>
          <p className="text-sm text-ink-muted">/{product.slug}</p>
        </div>
        <StatusBadge status={product.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProductAction} className="space-y-4">
            <input type="hidden" name="productId" value={product.id} />
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={product.title} required minLength={3} />
            </div>
            <div>
              <Label htmlFor="shortDescription">Short description</Label>
              <Input id="shortDescription" name="shortDescription" defaultValue={product.short_description ?? ""} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="fullDescription">Full description</Label>
              <Textarea id="fullDescription" name="fullDescription" rows={6} defaultValue={product.full_description ?? ""} />
            </div>
            <div>
              <Label htmlFor="categoryId">Category</Label>
              <Select id="categoryId" name="categoryId" defaultValue={product.category_id ?? ""}>
                <option value="">Select a category</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            <fieldset className="space-y-4 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium text-ink">Pricing</legend>
              <div>
                <Label htmlFor="pricingModel">Pricing model</Label>
                <Select id="pricingModel" name="pricingModel" defaultValue={product.pricing_model}>
                  <option value="fixed">Fixed price</option>
                  <option value="pay_what_you_want">Pay what you want</option>
                  <option value="free">Free</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="basePriceMinor">Price (minor units, e.g. cents)</Label>
                  <Input id="basePriceMinor" name="basePriceMinor" type="number" min={0} defaultValue={product.base_price_minor} />
                </div>
                <div>
                  <Label htmlFor="pwywMinimumMinor">PWYW minimum</Label>
                  <Input id="pwywMinimumMinor" name="pwywMinimumMinor" type="number" min={0} defaultValue={product.pwyw_minimum_minor} />
                </div>
              </div>
              <div>
                <Label htmlFor="currencyCode">Currency</Label>
                <Input id="currencyCode" name="currencyCode" defaultValue={product.currency_code} maxLength={3} required />
              </div>
              <p className="text-xs text-ink-muted">
                Current price: {formatMinorUnits(product.base_price_minor, product.currency_code)}
              </p>
            </fieldset>

            <div>
              <Label htmlFor="refundPolicy">Refund policy</Label>
              <Textarea id="refundPolicy" name="refundPolicy" rows={2} defaultValue={product.refund_policy ?? ""} />
            </div>
            <div>
              <Label htmlFor="supportTerms">Support terms</Label>
              <Textarea id="supportTerms" name="supportTerms" rows={2} defaultValue={product.support_terms ?? ""} />
            </div>

            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cover image</CardTitle>
          <CardDescription>Shown on product cards and the product page.</CardDescription>
        </CardHeader>
        <CardContent>
          {cover?.external_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.external_url} alt="" className="mb-4 h-40 w-full rounded-md object-cover" />
          ) : null}
          <ProductMediaUploader productId={product.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>Private, entitlement-gated. Only delivered after a verified purchase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {files && files.length > 0 ? (
            <ul className="divide-y divide-border">
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{file.file_name}</span>
                  <span className="text-ink-muted">{(file.size_bytes / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No files uploaded yet.</p>
          )}
          <ProductFileUploader productId={product.id} />
        </CardContent>
      </Card>

      {product.status === "draft" || product.status === "rejected" ? (
        <Card>
          <CardHeader>
            <CardTitle>Submit for review</CardTitle>
            <CardDescription>An admin reviews new products before they appear in marketplace search.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitProductForReviewAction}>
              <input type="hidden" name="productId" value={product.id} />
              <Button type="submit">Submit for marketplace review</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
