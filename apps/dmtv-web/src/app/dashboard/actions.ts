"use server";

import { redirect } from "next/navigation";
import { requestPayout } from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { getCreatorSession } from "@/lib/session";

export async function requestPayoutAction(formData: FormData): Promise<void> {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  const amountMinorUnits = Number(formData.get("amountMinorUnits") ?? 0);
  if (!(amountMinorUnits > 0)) throw new Error("No balance available to pay out.");

  const { pool, flowraPayClient, events } = getDmtvContext();
  await requestPayout(
    pool,
    { flowraPay: flowraPayClient, events },
    {
      organizationId: session.organizationId,
      creatorId: session.creatorId,
      actingUserId: session.userId,
      amount: { amountMinorUnits, currency: "USD" },
    },
  );

  redirect("/dashboard?paid=1");
}
