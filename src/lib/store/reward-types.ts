export type RewardGrantStatus = "pending_review" | "approved" | "denied" | "fulfilled";

export interface RewardGrant {
  id: string;
  subscriberId: string;
  milestoneId: string;
  qualifiedCountAtGrant: number;
  status: RewardGrantStatus;
  fraudFlag: boolean;
  fraudReason: string | null;
  deniedReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRewardGrantInput {
  subscriberId: string;
  milestoneId: string;
  qualifiedCountAtGrant: number;
  status: RewardGrantStatus;
  fraudFlag: boolean;
  fraudReason: string | null;
}
