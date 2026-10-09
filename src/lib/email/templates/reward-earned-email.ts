import { book } from "@/config/site";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import type { RewardMilestone } from "@/config/rewards";

export function buildRewardEarnedEmail(opts: {
  firstName: string;
  milestone: RewardMilestone;
  fulfilled: boolean;
  statusUrl: string;
}) {
  const { firstName, milestone, fulfilled, statusUrl } = opts;

  const bodyHtml = fulfilled
    ? `
      <p style="margin:0 0 16px;">
        Congratulations, ${firstName} — you've reached <strong style="color:#f7f4ec;">${milestone.threshold}
        qualified referral${milestone.threshold === 1 ? "" : "s"}</strong> and unlocked:
      </p>
      <p style="margin:0 0 16px;color:#d4af37;font-weight:bold;">${milestone.name}</p>
      <p style="margin:0;">${milestone.description}</p>
    `
    : `
      <p style="margin:0 0 16px;">
        Congratulations, ${firstName} — you've reached <strong style="color:#f7f4ec;">${milestone.threshold}
        qualified referral${milestone.threshold === 1 ? "" : "s"}</strong> and earned:
      </p>
      <p style="margin:0 0 16px;color:#d4af37;font-weight:bold;">${milestone.name}</p>
      <p style="margin:0 0 16px;">${milestone.description}</p>
      <p style="margin:0;">
        This reward is being reviewed and will be delivered shortly — we'll email you again once
        it's on its way.
      </p>
    `;

  const html = renderEmailLayout({
    preheader: `You've earned a referral reward: ${milestone.name}`,
    heading: fulfilled ? "Reward unlocked" : "Reward earned — review in progress",
    bodyHtml,
    button: { label: "View My Referral Status", href: statusUrl },
  });

  const text = `${fulfilled ? "Reward unlocked" : "Reward earned — review in progress"}

Congratulations, ${firstName} — you've reached ${milestone.threshold} qualified referral(s) and ${fulfilled ? "unlocked" : "earned"}:
${milestone.name}
${milestone.description}

${fulfilled ? "" : "This reward is being reviewed and will be delivered shortly.\n"}
View your status: ${statusUrl}

${book.title} — ${book.author}
`;

  return {
    subject: fulfilled ? `You've unlocked: ${milestone.name}` : `You've earned a reward: ${milestone.name}`,
    html,
    text,
  };
}
