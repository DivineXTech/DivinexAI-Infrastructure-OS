import { renderEmailLayout } from "@/lib/email/templates/layout";

export function buildStatusLinkEmail(opts: { statusUrl: string }) {
  const { statusUrl } = opts;

  const html = renderEmailLayout({
    preheader: "Here's your secure link to view your waitlist status.",
    heading: "Your waitlist status link",
    bodyHtml: `
      <p style="margin:0 0 16px;">
        Use the button below to view your waitlist position, referral count, and
        Chapter 12 access. This link is unique to you — don't share it.
      </p>
    `,
    button: { label: "View My Status", href: statusUrl },
  });

  const text = `Your waitlist status link:\n${statusUrl}\n\nThis link is unique to you — don't share it.`;

  return { subject: "Your waitlist status link", html, text };
}
