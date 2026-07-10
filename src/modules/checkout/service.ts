import "server-only";
import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computePriceBreakdown, clampPayWhatYouWant, type Coupon, type FeeRule } from "@/modules/money/calculations";
import { getPaymentProvider } from "@/modules/payments";
import { writeAuditLog } from "@/modules/audit/log";
import type { Tables } from "@/lib/supabase/types";

export class CheckoutError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(2).toString("hex").toUpperCase();
  return `FM-${stamp}-${random}`;
}

async function resolveFeeRule(): Promise<FeeRule> {
  // Phase 1 uses a single global default fee rule. Country/product-type/plan
  // overrides (platform_fee_rules has columns for all three) are Phase 2 —
  // resolution order will become most-specific-match-wins.
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("platform_fee_rules")
    .select("percentage_bps, fixed_fee_minor")
    .eq("is_active", true)
    .is("product_type", null)
    .is("country_code", null)
    .is("plan_code", null)
    .limit(1)
    .maybeSingle();

  return {
    percentageBps: data?.percentage_bps ?? 900,
    fixedFeeMinor: data?.fixed_fee_minor ?? 0,
  };
}

export interface StartCheckoutInput {
  productId: string;
  buyerId: string | null;
  buyerEmail: string;
  couponCode?: string;
  pwywAmountMinor?: number;
}

export interface StartCheckoutResult {
  session: Tables<"checkout_sessions">;
  clientAction: Awaited<ReturnType<ReturnType<typeof getPaymentProvider>["createPaymentIntent"]>>["clientAction"];
}

export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  const supabase = createSupabaseAdminClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", input.productId)
    .maybeSingle();

  if (!product || product.status !== "published") {
    throw new CheckoutError("This product is not available for purchase.", "product_unavailable");
  }

  let subtotalMinor: number;
  if (product.pricing_model === "free") {
    subtotalMinor = 0;
  } else if (product.pricing_model === "pay_what_you_want") {
    subtotalMinor = clampPayWhatYouWant(input.pwywAmountMinor ?? 0, product.pwyw_minimum_minor);
  } else {
    // Fixed pricing: the server is the sole source of truth for price —
    // the browser's checkout form only ever sends the product id.
    subtotalMinor = product.base_price_minor;
  }

  let coupon: (Tables<"coupons"> & { discountMinor?: number }) | null = null;
  if (input.couponCode) {
    const { data: couponRow } = await supabase
      .from("coupons")
      .select("*")
      .eq("creator_id", product.creator_id)
      .ilike("code", input.couponCode)
      .eq("is_active", true)
      .maybeSingle();

    if (!couponRow) {
      throw new CheckoutError("This coupon code is not valid.", "invalid_coupon");
    }
    const now = new Date();
    if (couponRow.expires_at && new Date(couponRow.expires_at) < now) {
      throw new CheckoutError("This coupon has expired.", "expired_coupon");
    }
    if (couponRow.max_redemptions !== null && couponRow.redemption_count >= couponRow.max_redemptions) {
      throw new CheckoutError("This coupon has reached its redemption limit.", "coupon_exhausted");
    }
    coupon = couponRow;
  }

  const feeRule = await resolveFeeRule();
  const couponInput: Coupon | null = coupon
    ? { discountType: coupon.discount_type, discountValue: coupon.discount_value }
    : null;
  const breakdown = computePriceBreakdown({ subtotalMinor, coupon: couponInput, feeRule });

  const { data: session, error: sessionError } = await supabase
    .from("checkout_sessions")
    .insert({
      buyer_id: input.buyerId,
      buyer_email: input.buyerEmail,
      product_id: product.id,
      creator_id: product.creator_id,
      coupon_id: coupon?.id ?? null,
      pwyw_amount_minor: product.pricing_model === "pay_what_you_want" ? subtotalMinor : null,
      currency_code: product.currency_code,
      subtotal_minor: breakdown.subtotalMinor,
      discount_minor: breakdown.discountMinor,
      platform_fee_minor: breakdown.platformFeeMinor,
      tax_minor: breakdown.taxMinor,
      total_minor: breakdown.totalMinor,
      status: "open",
    })
    .select("*")
    .single();

  if (sessionError || !session) {
    throw new CheckoutError("Could not start checkout.", "session_create_failed");
  }

  if (breakdown.totalMinor === 0) {
    // Free products skip the payment provider entirely.
    return {
      session,
      clientAction: { type: "confirm", payload: { orderId: null, amountMinor: 0, currencyCode: product.currency_code, willSucceed: true } },
    };
  }

  const provider = getPaymentProvider();
  const intent = await provider.createPaymentIntent({
    orderId: session.id,
    amountMinor: breakdown.totalMinor,
    currencyCode: product.currency_code,
    buyerEmail: input.buyerEmail,
  });

  return { session, clientAction: intent.clientAction };
}

export interface CompleteCheckoutResult {
  order: Tables<"orders">;
  entitlementIds: string[];
}

/**
 * Finalizes a checkout session after the payment provider confirms success.
 * Creates the order, immutable order-item snapshot, payment record,
 * entitlement(s), customer upsert, and ledger entries in one place so every
 * successful purchase produces a consistent trail.
 */
export async function completeCheckout(sessionId: string, succeeded: boolean): Promise<CompleteCheckoutResult> {
  const supabase = createSupabaseAdminClient();

  const { data: session } = await supabase.from("checkout_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) throw new CheckoutError("Checkout session not found.", "session_not_found");
  if (session.status !== "open") throw new CheckoutError("Checkout session already completed.", "session_closed");

  const { data: product } = await supabase.from("products").select("*").eq("id", session.product_id).maybeSingle();
  if (!product) throw new CheckoutError("Product no longer exists.", "product_missing");

  const orderNumber = generateOrderNumber();
  const orderStatus = succeeded ? "fulfilled" : "failed";

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      checkout_session_id: session.id,
      buyer_id: session.buyer_id,
      buyer_email: session.buyer_email,
      creator_id: session.creator_id,
      currency_code: session.currency_code,
      subtotal_minor: session.subtotal_minor,
      discount_minor: session.discount_minor,
      platform_fee_minor: session.platform_fee_minor,
      tax_minor: session.tax_minor,
      total_minor: session.total_minor,
      coupon_id: session.coupon_id,
      status: orderStatus,
    })
    .select("*")
    .single();

  if (orderError || !order) throw new CheckoutError("Could not create order.", "order_create_failed");

  await supabase.from("checkout_sessions").update({ status: succeeded ? "completed" : "cancelled", completed_order_id: order.id }).eq("id", session.id);

  const creatorNetMinor = Math.max(0, session.subtotal_minor - session.discount_minor - session.platform_fee_minor);

  const { data: orderItem, error: itemError } = await supabase
    .from("order_items")
    .insert({
      order_id: order.id,
      product_id: product.id,
      product_title_snapshot: product.title,
      product_type_snapshot: product.product_type,
      unit_price_minor: session.subtotal_minor,
      line_subtotal_minor: session.subtotal_minor,
      creator_net_minor: creatorNetMinor,
      platform_fee_minor: session.platform_fee_minor,
    })
    .select("*")
    .single();

  if (itemError || !orderItem) throw new CheckoutError("Could not record order item.", "order_item_create_failed");

  await supabase.from("payments").insert({
    order_id: order.id,
    provider: "mock",
    status: succeeded ? "succeeded" : "failed",
    amount_minor: session.total_minor,
    currency_code: session.currency_code,
    failure_reason: succeeded ? null : "Payment declined by mock provider.",
  });

  if (!succeeded) {
    await writeAuditLog({
      actorId: session.buyer_id,
      action: "order.payment_failed",
      entityType: "order",
      entityId: order.id,
      metadata: { orderNumber },
    });
    return { order, entitlementIds: [] };
  }

  const entitlementIds: string[] = [];
  if (session.buyer_id) {
    const { data: entitlement } = await supabase
      .from("entitlements")
      .insert({
        order_item_id: orderItem.id,
        product_id: product.id,
        buyer_id: session.buyer_id,
        status: "active",
      })
      .select("id")
      .single();
    if (entitlement) entitlementIds.push(entitlement.id);
  }

  if (session.coupon_id) {
    await supabase.from("coupon_redemptions").insert({
      coupon_id: session.coupon_id,
      order_id: order.id,
      buyer_id: session.buyer_id,
      discount_minor: session.discount_minor,
    });
    const { data: coupon } = await supabase.from("coupons").select("redemption_count").eq("id", session.coupon_id).maybeSingle();
    if (coupon) {
      await supabase.from("coupons").update({ redemption_count: coupon.redemption_count + 1 }).eq("id", session.coupon_id);
    }
  }

  await supabase.from("products").update({ units_sold: product.units_sold + 1 }).eq("id", product.id);

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("*")
    .eq("creator_id", session.creator_id)
    .eq("email", session.buyer_email)
    .maybeSingle();

  if (existingCustomer) {
    await supabase
      .from("customers")
      .update({
        last_order_at: new Date().toISOString(),
        orders_count: existingCustomer.orders_count + 1,
        lifetime_spend_minor: existingCustomer.lifetime_spend_minor + session.total_minor,
        buyer_id: session.buyer_id ?? existingCustomer.buyer_id,
      })
      .eq("id", existingCustomer.id);
  } else {
    await supabase.from("customers").insert({
      creator_id: session.creator_id,
      buyer_id: session.buyer_id,
      email: session.buyer_email,
      currency_code: session.currency_code,
    });
  }

  await supabase.from("ledger_entries").insert([
    {
      entry_type: "customer_payment",
      direction: "credit",
      amount_minor: session.total_minor,
      currency_code: session.currency_code,
      order_id: order.id,
      creator_id: session.creator_id,
      provider: "mock",
    },
    {
      entry_type: "platform_fee",
      direction: "debit",
      amount_minor: session.platform_fee_minor,
      currency_code: session.currency_code,
      order_id: order.id,
      creator_id: session.creator_id,
      provider: "mock",
    },
    {
      entry_type: "creator_earning",
      direction: "credit",
      amount_minor: creatorNetMinor,
      currency_code: session.currency_code,
      order_id: order.id,
      creator_id: session.creator_id,
      provider: "mock",
    },
  ]);

  const { data: balance } = await supabase.from("creator_balances").select("*").eq("creator_id", session.creator_id).maybeSingle();
  if (balance) {
    await supabase
      .from("creator_balances")
      .update({
        available_minor: balance.available_minor + creatorNetMinor,
        lifetime_earnings_minor: balance.lifetime_earnings_minor + creatorNetMinor,
        updated_at: new Date().toISOString(),
      })
      .eq("creator_id", session.creator_id);
  } else {
    await supabase.from("creator_balances").insert({
      creator_id: session.creator_id,
      currency_code: session.currency_code,
      available_minor: creatorNetMinor,
      lifetime_earnings_minor: creatorNetMinor,
    });
  }

  await writeAuditLog({
    actorId: session.buyer_id,
    action: "order.fulfilled",
    entityType: "order",
    entityId: order.id,
    metadata: { orderNumber, totalMinor: session.total_minor, currencyCode: session.currency_code },
  });

  return { order, entitlementIds };
}
