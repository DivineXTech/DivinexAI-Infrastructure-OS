import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe/client";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, hashIp } from "@/lib/security/request-ip";
import { book, siteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const PRICE_USD_CENTS = 1997; // $19.97

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
});

export async function POST(request: NextRequest) {
  // "Keep checkout disabled on the public BookOS page until founder
  // approval" — enforced here too, not just by hiding the button, so the
  // endpoint itself refuses to create sessions while disabled.
  if (!env.checkoutEnabled) {
    return NextResponse.json({ error: "Checkout is not yet available." }, { status: 403 });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    console.error("[api/checkout] Stripe is not configured but checkout is enabled.");
    return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 503 });
  }

  const ipKey = hashIp(getClientIp(request));
  const rateLimit = checkRateLimit(`checkout:${ipKey}`, 10, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional — Stripe Checkout can collect the email itself.
  }
  const parsed = bodySchema.safeParse(body);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product: env.stripeProductId,
            unit_amount: PRICE_USD_CENTS,
          },
          quantity: 1,
        },
      ],
      customer_email: parsed.success ? parsed.data.email : undefined,
      success_url: `${siteUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/join`,
      metadata: { book: book.title },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[api/checkout] Stripe session creation failed", error);
    return NextResponse.json({ error: "We couldn't start checkout. Please try again." }, { status: 500 });
  }
}
