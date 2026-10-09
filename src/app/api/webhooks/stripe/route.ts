import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { env } from "@/lib/env";
import { getPurchaseStore } from "@/lib/store/purchase-store";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { getAuditLogStore } from "@/lib/store/audit-log-store";
import { sendEmail } from "@/lib/email/resend";
import { buildPurchaseConfirmationEmail } from "@/lib/email/templates/purchase-confirmation-email";
import { issueToken } from "@/lib/security/tokens";

export const dynamic = "force-dynamic";

async function fulfillPurchase(purchaseId: string, email: string): Promise<void> {
  const downloadToken = issueToken(purchaseId, "ebook");
  const email_ = buildPurchaseConfirmationEmail({ email, downloadToken });
  await sendEmail({
    to: email,
    subject: email_.subject,
    html: email_.html,
    text: email_.text,
    emailType: "purchase_confirmation",
  });
  await getPurchaseStore().markFulfilled(purchaseId);
}

export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  if (!stripe || !env.stripeWebhookSecret) {
    console.error("[api/webhooks/stripe] Stripe is not fully configured.");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  // Signature verification requires the exact raw request body — do not
  // parse it as JSON first.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch (error) {
    console.error("[api/webhooks/stripe] Signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email ?? session.customer_email;

    if (!email) {
      console.error("[api/webhooks/stripe] checkout.session.completed with no email", session.id);
      return NextResponse.json({ received: true });
    }

    const subscriber = await getSubscriberStore().findByEmail(email.toLowerCase());

    const { purchase, created } = await getPurchaseStore().recordIfNotExists({
      subscriberId: subscriber?.id ?? null,
      email: email.toLowerCase(),
      stripeSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "usd",
      status: "paid",
    });

    if (created) {
      await getAuditLogStore().record({
        actor: "stripe_webhook",
        action: "purchase_recorded",
        target: purchase.id,
        metadata: { stripeSessionId: session.id, amountCents: purchase.amountCents },
      });
    }

    // Checked on `status`, not `created`: Stripe redelivers events (and a
    // prior delivery may have recorded the purchase but failed during
    // fulfillment below, returning 500 to request a retry). Re-attempting
    // fulfillment here is safe — markFulfilled() is idempotent, so the
    // only real risk is a duplicate email if fulfillment succeeded but the
    // response to Stripe was lost in transit, which is an acceptable
    // trade-off against the alternative (silently never fulfilling).
    if (purchase.status !== "fulfilled") {
      try {
        await fulfillPurchase(purchase.id, purchase.email);
      } catch (error) {
        console.error("[api/webhooks/stripe] fulfillment failed", error);
        return NextResponse.json({ error: "Fulfillment failed." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
