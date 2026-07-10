"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/modules/auth/session";
import { startCheckout, completeCheckout, CheckoutError } from "@/modules/checkout/service";

const startSchema = z.object({
  productId: z.string().uuid(),
  couponCode: z.string().optional(),
  pwywAmountMinor: z.coerce.number().int().min(0).optional(),
});

export async function submitCheckoutAction(formData: FormData) {
  const user = await requireUser();
  const email = user.email;
  if (!email) throw new Error("Your account has no email on file.");

  const parsed = startSchema.parse({
    productId: formData.get("productId"),
    couponCode: (formData.get("couponCode") as string) || undefined,
    pwywAmountMinor: (formData.get("pwywAmountMinor") as string) || undefined,
  });

  let sessionId: string;
  let willSucceed = true;

  try {
    const { session, clientAction } = await startCheckout({
      productId: parsed.productId,
      buyerId: user.id,
      buyerEmail: email,
      couponCode: parsed.couponCode,
      pwywAmountMinor: parsed.pwywAmountMinor,
    });
    sessionId = session.id;
    willSucceed = clientAction.type === "confirm" ? Boolean(clientAction.payload.willSucceed) : true;
  } catch (err) {
    if (err instanceof CheckoutError) {
      redirect(`/checkout/${formData.get("productSlug")}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  const { order } = await completeCheckout(sessionId, willSucceed);
  redirect(`/checkout/order/${order.id}`);
}
