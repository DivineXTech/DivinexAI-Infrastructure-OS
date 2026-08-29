"use server";

import { redirect } from "next/navigation";
import { purchaseProduct, registerFan } from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { getFanSession, setFanSession } from "@/lib/session";

export async function registerFanAction(formData: FormData): Promise<void> {
  const handle = String(formData.get("handle") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) throw new Error("Display name is required.");

  const { pool, events } = getDmtvContext();
  // organizationId is only used for the emitted event's routing key; registerFan itself is tenant-agnostic.
  const fan = await registerFan(pool, events, handle, displayName);
  await setFanSession({ fanUserId: fan.fanUserId, displayName: fan.displayName });

  redirect(`/creator/${handle}`);
}

export async function purchaseAction(formData: FormData): Promise<void> {
  const handle = String(formData.get("handle") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const productId = String(formData.get("productId") ?? "");

  const fanSession = await getFanSession();
  if (!fanSession) redirect(`/creator/${handle}`);

  const { pool, flowraPayClient, feeScheduleSource, events } = getDmtvContext();
  await purchaseProduct(
    pool,
    { flowraPay: flowraPayClient, feeScheduleSource, events },
    {
      organizationId,
      workspaceId,
      productId,
      fanId: fanSession!.fanUserId,
      fanDisplayName: fanSession!.displayName,
      idempotencyKey: `web:${fanSession!.fanUserId}:${productId}:${Date.now()}`,
    },
  );

  redirect(`/creator/${handle}?purchased=${productId}`);
}
