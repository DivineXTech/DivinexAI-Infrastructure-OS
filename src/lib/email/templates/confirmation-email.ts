import { book, siteUrl } from "@/config/site";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export function buildConfirmationEmail(opts: {
  firstName: string;
  chapter12Url: string;
  referralCode: string;
  statusUrl: string;
  unsubscribeUrl: string;
}) {
  const { firstName, chapter12Url, referralCode, statusUrl, unsubscribeUrl } = opts;
  const referralUrl = `${siteUrl}/referral/${referralCode}`;

  const html = renderEmailLayout({
    preheader: `You're on the waitlist. Here's your early access to ${book.earlyAccessChapter}.`,
    heading: `You're on the list, ${firstName}.`,
    bodyHtml: `
      <p style="margin:0 0 16px;">
        Thank you for supporting the launch of <strong style="color:#f7f4ec;">${book.title}</strong>
        by ${book.author}. Your spot on the early-access waitlist is confirmed.
      </p>
      <p style="margin:0 0 16px;">
        As a thank-you, you now have early access to <strong style="color:#d4af37;">${book.earlyAccessChapterTitle}</strong>,
        available before the full book releases.
      </p>
      <p style="margin:0 0 16px;">
        Your personal referral link — share it, and we'll track your referrals toward launch-day rewards:
      </p>
      <p style="margin:0 0 16px;padding:12px 16px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);border-radius:4px;word-break:break-all;">
        <a href="${referralUrl}" style="color:#e7c766;text-decoration:none;">${referralUrl}</a>
      </p>
      <p style="margin:0;">
        You can check your waitlist status and referral count anytime:
        <a href="${statusUrl}" style="color:#e7c766;">${statusUrl}</a>
      </p>
    `,
    button: { label: `Read ${book.earlyAccessChapter} Now`, href: chapter12Url },
    footerNote: `<a href="${unsubscribeUrl}" style="color:#78756c;">Unsubscribe</a> from launch emails at any time.`,
  });

  const text = `You're on the list, ${firstName}.

Thank you for supporting the launch of ${book.title} by ${book.author}. Your spot on the early-access waitlist is confirmed.

As a thank-you, you now have early access to ${book.earlyAccessChapterTitle}:
${chapter12Url}

Your referral link:
${referralUrl}

Check your status anytime:
${statusUrl}

Unsubscribe: ${unsubscribeUrl}
`;

  return { subject: `Your early access to ${book.earlyAccessChapter} is ready`, html, text };
}
