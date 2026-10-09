import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminRequestAuthorized } from "@/lib/admin/guard";
import { getRewardStore } from "@/lib/store/reward-store";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { getAuditLogStore } from "@/lib/store/audit-log-store";
import { getMilestoneById } from "@/config/rewards";
import { sendEmail } from "@/lib/email/resend";
import { buildRewardEarnedEmail } from "@/lib/email/templates/reward-earned-email";
import { issueToken } from "@/lib/security/tokens";
import { siteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum(["approve", "deny", "fulfill"]),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const rewardStore = getRewardStore();
  const statusMap = { approve: "approved", deny: "denied", fulfill: "fulfilled" } as const;
  const result = await rewardStore.updateGrantStatus(id, {
    status: statusMap[parsed.data.action],
    deniedReason: parsed.data.reason,
  });

  if (!result) {
    return NextResponse.json({ error: "Reward grant not found." }, { status: 404 });
  }
  const { grant, transitioned } = result;

  await getAuditLogStore().record({
    actor: "admin",
    action: `reward_${parsed.data.action}`,
    target: grant.id,
    metadata: { milestoneId: grant.milestoneId, subscriberId: grant.subscriberId },
  });

  // Only notify on a genuine transition to fulfilled — not on every PATCH
  // (e.g. a fulfill call on an already-fulfilled grant is a no-op in the
  // store and shouldn't re-send the email).
  if (parsed.data.action === "fulfill" && transitioned) {
    const milestone = getMilestoneById(grant.milestoneId);
    const subscriber = await getSubscriberStore().findById(grant.subscriberId);
    if (milestone && subscriber) {
      const statusToken = issueToken(subscriber.id, "status");
      const email = buildRewardEarnedEmail({
        firstName: subscriber.firstName,
        milestone,
        fulfilled: true,
        statusUrl: `${siteUrl}/status?token=${statusToken}`,
      });
      await sendEmail({
        to: subscriber.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        emailType: "reward_fulfilled",
        subscriberId: subscriber.id,
      });
    }
  }

  return NextResponse.json({ success: true, grant });
}
