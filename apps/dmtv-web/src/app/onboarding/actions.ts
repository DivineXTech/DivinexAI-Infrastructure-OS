"use server";

import { redirect } from "next/navigation";
import { completeOnboarding } from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { getCreatorSession } from "@/lib/session";

export async function completeOnboardingAction(formData: FormData): Promise<void> {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("Email is required to link a payout account.");

  const { pool, flowraPayClient, events } = getDmtvContext();
  await completeOnboarding(pool, flowraPayClient, events, {
    organizationId: session.organizationId,
    userId: session.userId,
    creatorId: session.creatorId,
    email,
  });

  redirect("/studio");
}
