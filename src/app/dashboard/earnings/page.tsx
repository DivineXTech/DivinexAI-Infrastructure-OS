import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState, ComingSoon } from "@/components/ui/states";
import { formatMinorUnits, formatDate } from "@/lib/utils";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardEarningsPage() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const [{ data: balance }, { data: entries }] = await Promise.all([
    supabase.from("creator_balances").select("*").eq("creator_id", membership.creator.id).maybeSingle(),
    supabase
      .from("ledger_entries")
      .select("*")
      .eq("creator_id", membership.creator.id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const currency = balance?.currency_code ?? "USD";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Earnings</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Available" value={formatMinorUnits(balance?.available_minor ?? 0, currency)} />
        <MetricCard label="Pending" value={formatMinorUnits(balance?.pending_minor ?? 0, currency)} />
        <MetricCard label="Lifetime earnings" value={formatMinorUnits(balance?.lifetime_earnings_minor ?? 0, currency)} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-ink">Payouts</h2>
          <ComingSoon />
        </div>
        <p className="text-sm text-ink-muted">
          Payout scheduling to a bank account or mobile money wallet ships with the Stripe/Paystack/Flutterwave
          integrations in Phase 2.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 font-display text-lg font-medium text-ink">Ledger</h2>
        {!entries || entries.length === 0 ? (
          <EmptyState title="No ledger activity yet" />
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium capitalize text-ink">{entry.entry_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-ink-muted">{formatDate(entry.created_at)}</p>
                </div>
                <span className={entry.direction === "credit" ? "text-success" : "text-danger"}>
                  {entry.direction === "credit" ? "+" : "-"}
                  {formatMinorUnits(entry.amount_minor, entry.currency_code)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
