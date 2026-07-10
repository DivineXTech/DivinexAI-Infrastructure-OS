import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ComingSoon } from "@/components/ui/states";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCouponAction, toggleCouponAction } from "@/modules/coupons/actions";

export default async function DashboardMarketingPage() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const { data: coupons } = await supabase
    .from("coupons")
    .select("*")
    .eq("creator_id", membership.creator.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-display text-2xl font-medium text-ink">Marketing</h1>

      <Card>
        <CardHeader>
          <CardTitle>Discount codes</CardTitle>
          <CardDescription>Applied at checkout — the discount is calculated on the server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={createCouponAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="LAUNCH20" required minLength={3} />
            </div>
            <div>
              <Label htmlFor="discountType">Type</Label>
              <Select id="discountType" name="discountType" defaultValue="percentage">
                <option value="percentage">Percent</option>
                <option value="fixed">Fixed</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="discountValue">Value</Label>
              <Input id="discountValue" name="discountValue" type="number" min={1} required defaultValue={10} />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Add
              </Button>
            </div>
          </form>

          {!coupons || coupons.length === 0 ? (
            <EmptyState title="No discount codes yet" />
          ) : (
            <ul className="divide-y divide-border">
              {coupons.map((coupon) => (
                <li key={coupon.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{coupon.code}</p>
                    <p className="text-xs text-ink-muted">
                      {coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `${coupon.discount_value} off`} ·{" "}
                      {coupon.redemption_count} used
                      {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={coupon.is_active ? "success" : "neutral"}>{coupon.is_active ? "Active" : "Disabled"}</Badge>
                    <form action={toggleCouponAction}>
                      <input type="hidden" name="couponId" value={coupon.id} />
                      <input type="hidden" name="isActive" value={String(coupon.is_active)} />
                      <Button type="submit" variant="ghost" size="sm">
                        {coupon.is_active ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Email &amp; subscribers</CardTitle>
            <ComingSoon />
          </div>
          <CardDescription>Subscriber collection and creator email tools ship in Phase 3.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Affiliates</CardTitle>
            <ComingSoon />
          </div>
          <CardDescription>Affiliate programs and tracked links ship in Phase 3.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
