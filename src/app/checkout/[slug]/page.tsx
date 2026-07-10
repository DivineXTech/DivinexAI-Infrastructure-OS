import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { requireUser } from "@/modules/auth/session";
import { getPublishedProductBySlug } from "@/modules/catalog/service";
import { submitCheckoutAction } from "@/modules/checkout/page-actions";
import { formatMinorUnits } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const user = await requireUser();

  const result = await getPublishedProductBySlug(slug);
  if (!result) notFound();
  const { product } = result;

  return (
    <div className="mx-auto max-w-md py-16 px-4">
      <Card>
        <CardHeader>
          <CardTitle>{product.title}</CardTitle>
          <CardDescription>
            {product.pricing_model === "free" ? "Free" : formatMinorUnits(product.base_price_minor, product.currency_code)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitCheckoutAction} className="space-y-4">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="productSlug" value={product.slug} />

            <div>
              <Label>Buyer email</Label>
              <Input value={user.email ?? ""} disabled readOnly />
            </div>

            {product.pricing_model === "pay_what_you_want" ? (
              <div>
                <Label htmlFor="pwywAmountMinor">Your price (minor units)</Label>
                <Input
                  id="pwywAmountMinor"
                  name="pwywAmountMinor"
                  type="number"
                  min={product.pwyw_minimum_minor}
                  defaultValue={product.pwyw_minimum_minor}
                  required
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Minimum {formatMinorUnits(product.pwyw_minimum_minor, product.currency_code)}
                </p>
              </div>
            ) : null}

            <div>
              <Label htmlFor="couponCode">Coupon code (optional)</Label>
              <Input id="couponCode" name="couponCode" placeholder="LAUNCH20" />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}

            <p className="text-xs text-ink-muted">
              This is a mock checkout for development. No real payment is collected — buyer emails starting with
              &quot;declined@&quot; simulate a failed payment.
            </p>

            <Button type="submit" className="w-full" size="lg">
              {product.pricing_model === "free" ? "Get it free" : "Complete purchase"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
