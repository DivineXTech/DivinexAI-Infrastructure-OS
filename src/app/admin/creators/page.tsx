import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { approveSellerVerificationAction, rejectSellerVerificationAction } from "@/modules/admin/actions";

export default async function AdminCreatorsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: creators } = await supabase.from("creator_accounts").select("*").order("created_at", { ascending: false });

  if (!creators || creators.length === 0) {
    return (
      <div>
        <h1 className="mb-6 font-display text-2xl font-medium text-ink">Creators</h1>
        <EmptyState title="No creators yet" />
      </div>
    );
  }

  const creatorIds = creators.map((c) => c.id);
  const [{ data: verifications }, { data: storefronts }] = await Promise.all([
    supabase.from("seller_verifications").select("*").in("creator_id", creatorIds),
    supabase.from("storefronts").select("creator_id, slug, store_name").in("creator_id", creatorIds),
  ]);

  const verificationByCreator = new Map((verifications ?? []).map((v) => [v.creator_id, v]));
  const storefrontByCreator = new Map((storefronts ?? []).map((s) => [s.creator_id, s]));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Creators</h1>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-paper-muted text-left text-xs font-medium uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {creators.map((creator) => {
              const verification = verificationByCreator.get(creator.id);
              const storefront = storefrontByCreator.get(creator.id);
              return (
                <tr key={creator.id}>
                  <td className="px-4 py-3 font-medium text-ink">{storefront?.store_name ?? "Unnamed store"}</td>
                  <td className="px-4 py-3 text-ink-muted">{creator.country_code}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={verification?.status ?? "not_started"} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(creator.created_at)}</td>
                  <td className="px-4 py-3">
                    {verification?.status === "pending" ? (
                      <div className="flex gap-2">
                        <form action={approveSellerVerificationAction}>
                          <input type="hidden" name="creatorId" value={creator.id} />
                          <Button type="submit" size="sm">
                            Approve
                          </Button>
                        </form>
                        <form action={rejectSellerVerificationAction}>
                          <input type="hidden" name="creatorId" value={creator.id} />
                          <Button type="submit" size="sm" variant="danger">
                            Reject
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
