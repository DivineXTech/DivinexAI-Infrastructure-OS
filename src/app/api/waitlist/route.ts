import { after, NextResponse, type NextRequest } from "next/server";
import { waitlistFormSchema } from "@/lib/validation/schemas";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { issueToken } from "@/lib/security/tokens";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, hashIp } from "@/lib/security/request-ip";
import { sendEmail } from "@/lib/email/resend";
import { buildConfirmationEmail } from "@/lib/email/templates/confirmation-email";
import { isValidReferralCodeFormat, normalizeReferralCode } from "@/lib/referral";
import { evaluateRewardsForReferrer } from "@/lib/rewards/reward-engine";
import { siteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const MIN_FORM_FILL_MS = 1200;

export async function POST(request: NextRequest) {
  const ipKey = hashIp(getClientIp(request));
  const rateLimit = checkRateLimit(`waitlist:${ipKey}`, 5, 10 * 60 * 1000);
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

  const parsed = waitlistFormSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const data = parsed.data;

  // Honeypot field: schema already rejects a non-empty value, but double
  // check explicitly in case the schema evolves.
  if (data.companyWebsite) {
    return NextResponse.json({ error: "Submission rejected." }, { status: 400 });
  }

  // Basic bot heuristic: a human takes at least ~1.2s to complete this form.
  if (
    typeof data.formRenderedAtMs === "number" &&
    Date.now() - data.formRenderedAtMs < MIN_FORM_FILL_MS
  ) {
    return NextResponse.json({ error: "Submission rejected." }, { status: 400 });
  }

  const referredBy =
    data.referralCode && isValidReferralCodeFormat(data.referralCode)
      ? normalizeReferralCode(data.referralCode)
      : null;

  const store = getSubscriberStore();

  let subscriber;
  let isNew = false;
  try {
    const result = await store.upsertByEmail({
      firstName: data.firstName,
      lastName: data.lastName || null,
      email: data.email,
      phone: data.phone || null,
      country: data.country || null,
      marketingConsent: data.marketingConsent,
      termsAccepted: data.termsAccepted,
      referredBy,
      socialFollowConfirmed: data.socialFollowConfirmed,
      socialLikeConfirmed: data.socialLikeConfirmed,
      socialShareConfirmed: data.socialShareConfirmed,
      source: data.source || "landing",
    });
    subscriber = result.subscriber;
    isNew = result.isNew;
  } catch (error) {
    console.error("[api/waitlist] upsert failed", error);
    return NextResponse.json(
      { error: "We couldn't save your submission. Please try again shortly." },
      { status: 500 },
    );
  }

  // Only a genuinely new signup can newly qualify a referral — re-running
  // this for repeat submissions from the same email would be a no-op
  // anyway (evaluateRewardsForReferrer is idempotent), but skipping it
  // avoids the extra store round-trips on the common "already joined" path.
  //
  // Scheduled with `after()` rather than awaited inline (doesn't delay the
  // signup response) or fire-and-forget (on a serverless platform the
  // function can be frozen before an un-awaited promise finishes — `after()`
  // is Next's supported way to run work guaranteed to complete after the
  // response is sent, e.g. via Vercel's waitUntil).
  if (isNew && referredBy) {
    after(() =>
      evaluateRewardsForReferrer(referredBy).catch((error) => {
        console.error("[api/waitlist] reward evaluation failed", error);
      }),
    );
  }

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

  const sendResult = await sendEmail({ to: subscriber.email, subject: email.subject, html: email.html, text: email.text });
  if (!sendResult.delivered && !sendResult.simulated) {
    console.error("[api/waitlist] confirmation email failed to send", sendResult.error);
  }

  return NextResponse.json({
    success: true,
    subscriber: { firstName: subscriber.firstName, referralCode: subscriber.referralCode },
    chapter12Token,
  });
}
