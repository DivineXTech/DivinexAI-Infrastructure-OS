import { rewardMilestones } from "@/config/rewards";
import type { RewardGrant } from "@/lib/store/reward-types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<RewardGrant["status"], string> = {
  pending_review: "Earned — in review",
  approved: "Approved — fulfilling soon",
  fulfilled: "Delivered",
  denied: "Not approved",
};

export function RewardProgress({
  qualifiedCount,
  grants,
}: {
  qualifiedCount: number;
  grants: RewardGrant[];
}) {
  const grantByMilestone = new Map(grants.map((g) => [g.milestoneId, g]));

  return (
    <div className="flex flex-col gap-3">
      {rewardMilestones.map((milestone) => {
        const grant = grantByMilestone.get(milestone.id);
        const reached = qualifiedCount >= milestone.threshold;

        return (
          <div
            key={milestone.id}
            className={cn(
              "glass-panel flex items-center justify-between gap-4 rounded-xl p-4",
              !reached && "opacity-50",
            )}
          >
            <div>
              <p className="text-sm font-medium text-paper">
                {milestone.threshold} referral{milestone.threshold === 1 ? "" : "s"} —{" "}
                {milestone.name}
              </p>
              <p className="mt-1 text-xs text-paper-dim">{milestone.description}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap",
                grant?.status === "fulfilled"
                  ? "bg-gold-400/15 text-gold-300"
                  : grant
                    ? "bg-violet-400/15 text-violet-300"
                    : "bg-white/5 text-paper-dim/60",
              )}
            >
              {grant ? STATUS_LABEL[grant.status] : reached ? "Processing…" : "Locked"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
