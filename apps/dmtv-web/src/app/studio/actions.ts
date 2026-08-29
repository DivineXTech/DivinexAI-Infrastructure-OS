"use server";

import { redirect } from "next/navigation";
import {
  createAssetFromGeneration,
  createProduct,
  declareRights,
  generateAiContent,
  publishAsset,
} from "@divinexai/dmtv-core";
import { parseDecimalToMinorUnits } from "@divinexai/schemas";
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
  const priceDollarsInput = String(formData.get("priceDollars") ?? "").trim();
  if (!assetId || !name || !priceDollarsInput) {
    throw new Error("Asset, product name, and a positive price are required.");
  }
  // Parsed via string/BigInt math (never `Number(input) * 100`) so a
  // user-typed dollar amount can't pick up binary floating-point error on
  // its way to becoming the stored integer minor-unit price.
  const priceMinorUnits = parseDecimalToMinorUnits(priceDollarsInput);
  if (priceMinorUnits <= 0) {
    throw new Error("Price must be positive.");
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
    price: { amountMinorUnits: priceMinorUnits, currency: "USD" },
  });

  redirect(`/studio?assetId=${assetId}&step=done`);
}
