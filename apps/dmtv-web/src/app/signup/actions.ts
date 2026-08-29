"use server";

import { redirect } from "next/navigation";
import { grantAiCredits, signUpCreator } from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { setCreatorSession } from "@/lib/session";

const STARTER_AI_CREDITS = 500;

export async function signUpAction(formData: FormData): Promise<void> {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!organizationName || !displayName) {
    throw new Error("Organization name and display name are required.");
  }

  const { pool, events } = getDmtvContext();
  const result = await signUpCreator(pool, events, { organizationName, displayName });
  await grantAiCredits(pool, result.organization.id, STARTER_AI_CREDITS);

  await setCreatorSession({
    userId: result.userId,
    organizationId: result.organization.id,
    organizationName: result.organization.name,
    workspaceId: result.workspace.id,
    creatorId: result.creatorProfile.id,
    handle: result.creatorProfile.handle,
    displayName: result.creatorProfile.displayName,
  });

  redirect("/onboarding");
}
