import { book, siteUrl } from "@/config/site";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export function buildPurchaseConfirmationEmail(opts: { email: string; downloadToken: string }) {
  const { downloadToken } = opts;
  const downloadUrl = `${siteUrl}/purchase/download?token=${downloadToken}`;

  const html = renderEmailLayout({
    preheader: `Your copy of ${book.title} is ready.`,
    heading: "Thank you for your purchase",
    bodyHtml: `
      <p style="margin:0 0 16px;">
        Your purchase of <strong style="color:#f7f4ec;">${book.title}</strong> (${book.edition})
        is confirmed. Your download link is below — it expires 10 minutes after each click, so
        return to this email and click again if you need it later.
      </p>
    `,
    button: { label: "Download Your Ebook", href: downloadUrl },
  });

  const text = `Thank you for your purchase.

Your purchase of ${book.title} (${book.edition}) is confirmed.

Download: ${downloadUrl}

This link expires 10 minutes after each click — return to this email and click again if you need it later.
`;

  return { subject: `Your copy of ${book.title} is ready`, html, text };
}
