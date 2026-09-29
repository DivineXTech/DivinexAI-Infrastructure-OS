import { NextResponse, type NextRequest } from "next/server";
import { statusRequestSchema } from "@/lib/validation/schemas";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { issueToken } from "@/lib/security/tokens";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, hashIp } from "@/lib/security/request-ip";
import { sendEmail } from "@/lib/email/resend";
import { buildConfirmationEmail } from "@/lib/email/templates/confirmation-email";
import { siteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const GENERIC_MESSAGE =
  "If that email is on our waitlist, we've sent a secure link to view your status and access Chapter 12.";

export async function POST(request: NextRequest) {
  const ipKey = hashIp(getClientIp(request));
  const rateLimit = checkRateLimit(`status:${ipKey}`, 5, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = statusRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const store = getSubscriberStore();
  const subscriber = await store.findByEmail(parsed.data.email);

  if (subscriber && !subscriber.unsubscribed) {
    const chapter12Token = issueToken(subscriber.id, "chapter12");
    const statusToken = issueToken(subscriber.id, "status");
    const unsubscribeToken = issueToken(subscriber.id, "unsubscribe");

    const email = buildConfirmationEmail({
      firstName: subscriber.firstName,
      chapter12Url: `${siteUrl}/chapter-12?token=${chapter12Token}`,
      referralCode: subscriber.referralCode,
      statusUrl: `${siteUrl}/status?token=${statusToken}`,
      unsubscribeUrl: `${siteUrl}/unsubscribe?token=${unsubscribeToken}`,
    });

    await sendEmail({ to: subscriber.email, subject: email.subject, html: email.html, text: email.text });
  }

  // Always return the same response, whether or not the email was found,
  // to avoid leaking which addresses are on the waitlist.
  return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
}
