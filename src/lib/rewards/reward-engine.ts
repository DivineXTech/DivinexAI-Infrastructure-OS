import "server-only";
import { rewardMilestones } from "@/config/rewards";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { getRewardStore } from "@/lib/store/reward-store";
import type { RewardGrant } from "@/lib/store/reward-types";
import type { Subscriber } from "@/lib/store/types";
import type { RewardMilestone } from "@/config/rewards";
import { sendEmail } from "@/lib/email/resend";
import { buildRewardEarnedEmail } from "@/lib/email/templates/reward-earned-email";
import { issueToken } from "@/lib/security/tokens";
import { siteUrl } from "@/config/site";

/**
 * Fraud heuristic: no external fraud service is wired up (none was
 * specified), so this is a self-contained velocity check — if a referrer
 * accrues several qualified referrals in a very short window, that's
 * consistent with scripted/bulk-created referred accounts rather than
 * organic sharing. It never blocks a reward outright; it forces
 * `pending_review` even for the otherwise-auto-fulfillable milestone, so a
 * human looks at it before anything is granted.
 */
const FRAUD_VELOCITY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const FRAUD_VELOCITY_THRESHOLD = 3; // 3+ qualified referrals inside the window

function detectVelocityFraud(referralTimestamps: string[]): {
  flagged: boolean;
  reason: string | null;
} {
  if (referralTimestamps.length < FRAUD_VELOCITY_THRESHOLD) return { flagged: false, reason: null };

  for (let i = 0; i + FRAUD_VELOCITY_THRESHOLD - 1 < referralTimestamps.length; i++) {
    const windowStart = new Date(referralTimestamps[i]).getTime();
    const windowEnd = new Date(referralTimestamps[i + FRAUD_VELOCITY_THRESHOLD - 1]).getTime();
    if (windowEnd - windowStart <= FRAUD_VELOCITY_WINDOW_MS) {
      return {
        flagged: true,
        reason:
          `${FRAUD_VELOCITY_THRESHOLD} qualified referrals landed within ` +
          `${Math.round((windowEnd - windowStart) / 1000)}s of each other.`,
      };
    }
  }
  return { flagged: false, reason: null };
}

export interface RewardEvaluationResult {
  newGrants: RewardGrant[];
}

/**
 * Re-evaluates a referrer's reward milestones and grants any newly-reached
 * ones. Call after any event that could change their qualified referral
 * count (a new referred signup; a referred subscriber unsubscribing no
 * longer applies here since that only ever *decreases* a count and
 * existing grants aren't revoked retroactively).
 *
 * Idempotent: `reward_grants` has a unique (subscriber_id, milestone_id)
 * constraint, and `createGrantIfNotExists` / `updateGrantStatus` never
 * re-grant or re-fulfill — safe to call repeatedly for the same referrer.
 */
export async function evaluateRewardsForReferrer(
  referralCode: string,
): Promise<RewardEvaluationResult> {
  const subscriberStore = getSubscriberStore();
  const rewardStore = getRewardStore();

  const referrer = await subscriberStore.findByReferralCode(referralCode);
  if (!referrer) return { newGrants: [] };

  const qualifiedReferrals = await subscriberStore.listQualifiedReferrals(referralCode);
  const qualifiedCount = qualifiedReferrals.length;
  const fraud = detectVelocityFraud(qualifiedReferrals.map((r) => r.createdAt));

  const newGrants: RewardGrant[] = [];

  for (const milestone of rewardMilestones) {
    if (qualifiedCount < milestone.threshold) continue;

    const status = fraud.flagged || !milestone.autoFulfillable ? "pending_review" : "fulfilled";

    const { grant, created } = await rewardStore.createGrantIfNotExists({
      subscriberId: referrer.id,
      milestoneId: milestone.id,
      qualifiedCountAtGrant: qualifiedCount,
      status,
      fraudFlag: fraud.flagged,
      fraudReason: fraud.reason,
    });

    if (created) {
      newGrants.push(grant);
      await notifyReferrerOfNewGrant(referrer, milestone, grant.status === "fulfilled").catch(
        (error) => {
          console.error("[reward-engine] failed to send reward notification email", error);
        },
      );
    }
  }

  return { newGrants };
}

async function notifyReferrerOfNewGrant(
  referrer: Subscriber,
  milestone: RewardMilestone,
  fulfilled: boolean,
): Promise<void> {
  const statusToken = issueToken(referrer.id, "status");
  const email = buildRewardEarnedEmail({
    firstName: referrer.firstName,
    milestone,
    fulfilled,
    statusUrl: `${siteUrl}/status?token=${statusToken}`,
  });
  await sendEmail({
    to: referrer.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    emailType: fulfilled ? "reward_fulfilled" : "reward_earned",
    subscriberId: referrer.id,
  });
}
