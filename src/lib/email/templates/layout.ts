import { book } from "@/config/site";

export interface EmailButton {
  label: string;
  href: string;
}

export function renderEmailLayout(opts: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  button?: EmailButton;
  footerNote?: string;
}): string {
  const { preheader, heading, bodyHtml, button, footerNote } = opts;

  const buttonHtml = button
    ? `
    <tr>
      <td align="center" style="padding: 32px 0 8px;">
        <a href="${button.href}"
           style="background-color:#d4af37;color:#0a0a0d;text-decoration:none;
                  font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:15px;
                  padding:14px 32px;border-radius:4px;display:inline-block;letter-spacing:0.02em;">
          ${button.label}
        </a>
      </td>
    </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0d;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0d;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#111116;border:1px solid rgba(212,175,55,0.25);border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0;text-align:center;">
                <p style="margin:0;color:#d4af37;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:bold;">
                  ${book.publisher}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 0;text-align:center;">
                <h1 style="margin:0;color:#f7f4ec;font-size:22px;line-height:1.35;font-weight:normal;">
                  ${heading}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;">
                <div style="height:1px;background:linear-gradient(90deg,transparent,#d4af37,transparent);opacity:0.5;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0;color:#cbc6b8;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            ${buttonHtml}
            <tr>
              <td style="padding:32px 32px 28px;color:#78756c;font-size:12px;line-height:1.6;text-align:center;">
                ${footerNote ?? ""}
                <p style="margin:16px 0 0;">
                  ${book.title} — ${book.author}<br />
                  ${book.publisher}, ${book.publisherLocation}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
