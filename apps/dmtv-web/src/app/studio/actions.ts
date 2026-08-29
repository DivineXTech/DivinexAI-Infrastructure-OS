"use server";

import { redirect } from "next/navigation";
import {
  createAssetFromGeneration,
  createProduct,
  declareRights,
  generateAiContent,
  publishAsset,
} from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { getCreatorSession } from "@/lib/session";

export async function generateAction(formData: FormData): Promise<void> {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  const title = String(formData.get("title") ?? "").trim();
  const musicPrompt = String(formData.get("musicPrompt") ?? "").trim();
  const artworkPrompt = String(formData.get("artworkPrompt") ?? "").trim();
  if (!title || !musicPrompt) throw new Error("Title and a music prompt are required.");

  const { pool, gateway, events } = getDmtvContext();
  const common = {
    organizationId: session.organizationId,
    workspaceId: session.workspaceId,
    creatorId: session.creatorId,
    actingUserId: session.userId,
  };

  const musicGeneration = await generateAiContent(pool, gateway, events, {
    ...common,
    capability: "TEXT_TO_MUSIC",
    prompt: musicPrompt,
  });
  const artworkGeneration = artworkPrompt
    ? await generateAiContent(pool, gateway, events, { ...common, capability: "TEXT_TO_IMAGE", prompt: artworkPrompt })
    : undefined;

  const asset = await createAssetFromGeneration(pool, {
    ...common,
    title,
    assetType: "MUSIC_TRACK",
    musicGeneration,
    artworkGeneration,
  });

  redirect(`/studio?assetId=${asset.id}&step=rights`);
}

export async function declareRightsAndPublishAction(formData: FormData): Promise<void> {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) throw new Error("Missing assetId.");

  const { pool, events } = getDmtvContext();
  await declareRights(pool, {
    organizationId: session.organizationId,
    assetId,
    actingUserId: session.userId,
    contributors: [
      {
        userId: session.userId,
        displayName: session.displayName,
        role: "PRIMARY_ARTIST",
        revenueSplitBps: 10_000,
      },
    ],
    rightsDeclarations: [
      { rightsType: "MASTER", ownerUserId: session.userId, ownershipPct: 100 },
      { rightsType: "PUBLISHING", ownerUserId: session.userId, ownershipPct: 100 },
    ],
  });

  await publishAsset(pool, events, {
    organizationId: session.organizationId,
    assetId,
    actingUserId: session.userId,
    commercialUseAuthorized: true,
  });

  redirect(`/studio?assetId=${assetId}&step=product`);
}

export async function createProductAction(formData: FormData): Promise<void> {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  const assetId = String(formData.get("assetId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceDollars = Number(formData.get("priceDollars") ?? 0);
  if (!assetId || !name || !(priceDollars > 0)) {
    throw new Error("Asset, product name, and a positive price are required.");
  }

  const { pool } = getDmtvContext();
  await createProduct(pool, {
    organizationId: session.organizationId,
    workspaceId: session.workspaceId,
    creatorId: session.creatorId,
    actingUserId: session.userId,
    assetId,
    type: "DIGITAL_DOWNLOAD",
    name,
    price: { amountMinorUnits: Math.round(priceDollars * 100), currency: "USD" },
  });

  redirect(`/studio?assetId=${assetId}&step=done`);
}
