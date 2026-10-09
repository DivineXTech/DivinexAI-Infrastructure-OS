/**
 * Referral reward milestones. Centralized here so thresholds/copy can
 * change without touching the reward engine or any UI.
 *
 * `autoFulfillable: true` means the reward requires no physical/digital
 * asset to hand over — it's pure recognition, so the engine can mark it
 * `fulfilled` the moment it's earned. Every other milestone requires an
 * administrator to approve (and, where an asset is involved, attach/confirm
 * it) before fulfillment — see src/lib/rewards/reward-engine.ts and the
 * admin dashboard's Rewards tab. This is deliberate: "Do not automatically
 * issue unapproved or unavailable rewards."
 */
export interface RewardMilestone {
  id: string;
  threshold: number;
  name: string;
  description: string;
  autoFulfillable: boolean;
}

export const rewardMilestones: RewardMilestone[] = [
  {
    id: "milestone-1",
    threshold: 1,
    name: "Early Supporter",
    description: "Recognition as an Early Supporter of the launch.",
    autoFulfillable: true,
  },
  {
    id: "milestone-3",
    threshold: 3,
    name: "AI Wealth Toolkit",
    description: "The AI Wealth Toolkit, delivered digitally.",
    autoFulfillable: false,
  },
  {
    id: "milestone-10",
    threshold: 10,
    name: "Early Digital-Release Bonus",
    description: "An early digital-release bonus ahead of general launch.",
    autoFulfillable: false,
  },
  {
    id: "milestone-25",
    threshold: 25,
    name: "Complete Digital Edition + Launch Q&A",
    description:
      "The complete digital edition of the book, plus an invitation to the launch Q&A.",
    autoFulfillable: false,
  },
].sort((a, b) => a.threshold - b.threshold);

export function getMilestoneById(id: string): RewardMilestone | undefined {
  return rewardMilestones.find((m) => m.id === id);
}
