import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateStorefrontAction } from "@/modules/storefronts/actions";

export default async function DashboardStorefrontPage() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const { data: storefront } = await supabase.from("storefronts").select("*").eq("creator_id", membership.creator.id).maybeSingle();

  if (!storefront) return null;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Storefront</h1>
        <p className="text-sm text-ink-muted">flowramarket.africa/@{storefront.slug}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>How buyers see your storefront on FlowraMarket.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateStorefrontAction} className="space-y-4">
            <div>
              <Label htmlFor="storeName">Store name</Label>
              <Input id="storeName" name="storeName" defaultValue={storefront.store_name} required />
            </div>
            <div>
              <Label htmlFor="tagline">Tagline</Label>
              <Input id="tagline" name="tagline" defaultValue={storefront.tagline ?? ""} maxLength={140} />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" defaultValue={storefront.category ?? ""} />
            </div>
            <div>
              <Label htmlFor="description">Bio</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={storefront.description ?? ""} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="isPublished" defaultChecked={storefront.is_published} />
              Published — visible in marketplace search
            </label>
            <Button type="submit">Save storefront</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
