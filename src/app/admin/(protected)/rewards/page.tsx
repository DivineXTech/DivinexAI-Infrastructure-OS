import { getRewardStore } from "@/lib/store/reward-store";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { getMilestoneById } from "@/config/rewards";
import { RewardActions } from "@/components/admin/reward-actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rewards", robots: { index: false, follow: false } };

const STATUS_FILTERS = ["pending_review", "approved", "fulfilled", "denied"] as const;

export default async function AdminRewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = STATUS_FILTERS.includes(params.status as (typeof STATUS_FILTERS)[number])
    ? (params.status as (typeof STATUS_FILTERS)[number])
    : "pending_review";

  const [{ grants, total }, subscriberStore] = await Promise.all([
    getRewardStore().listAll({ status, limit: 100, offset: 0 }),
    Promise.resolve(getSubscriberStore()),
  ]);

  const subscribers = await Promise.all(grants.map((g) => subscriberStore.findById(g.subscriberId)));

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-paper">Rewards ({total})</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <a
            key={filter}
            href={`?status=${filter}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === status
                ? "bg-gold-400/15 text-gold-300"
                : "bg-white/5 text-paper-dim hover:bg-white/10",
            )}
          >
            {filter.replace("_", " ")}
          </a>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {grants.map((grant, index) => {
          const milestone = getMilestoneById(grant.milestoneId);
          const subscriber = subscribers[index];
          return (
            <div key={grant.id} className="glass-panel rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-serif-display text-lg text-paper">
                    {milestone?.name ?? grant.milestoneId}
                  </p>
                  <p className="mt-1 text-sm text-paper-dim">
                    {subscriber ? `${subscriber.firstName} (${subscriber.email})` : grant.subscriberId}
                  </p>
                  <p className="mt-1 text-xs text-paper-dim/60">
                    Qualified at {grant.qualifiedCountAtGrant} referrals &middot; earned{" "}
                    {new Date(grant.createdAt).toLocaleDateString()}
                  </p>
                  {grant.fraudFlag && (
                    <p className="mt-2 text-xs text-rose-400">⚠ Flagged: {grant.fraudReason}</p>
                  )}
                </div>
                {status === "pending_review" || status === "approved" ? (
                  <RewardActions grantId={grant.id} />
                ) : (
                  <span className="text-xs text-paper-dim/60">
                    {grant.status === "fulfilled" && "Fulfilled"}
                    {grant.status === "denied" && `Denied: ${grant.deniedReason ?? ""}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {grants.length === 0 && (
          <p className="py-8 text-center text-sm text-paper-dim/60">No rewards in this status.</p>
        )}
      </div>
    </div>
  );
}
