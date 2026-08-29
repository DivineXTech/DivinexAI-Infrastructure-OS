import { z } from "zod";
import { territorySchema, uuidSchema } from "./common";

export const assetTypeSchema = z.enum([
  "MUSIC_TRACK",
  "VIDEO",
  "SHORT_FORM_VIDEO",
  "PODCAST_EPISODE",
  "IMAGE",
  "LICENSE_BUNDLE",
]);
export type AssetType = z.infer<typeof assetTypeSchema>;

export const assetStatusSchema = z.enum(["DRAFT", "RIGHTS_PENDING", "PUBLISHED", "TAKEN_DOWN"]);
export type AssetStatus = z.infer<typeof assetStatusSchema>;

export const assetSourceSchema = z.enum(["AI_GENERATED", "UPLOADED", "HYBRID"]);
export type AssetSource = z.infer<typeof assetSourceSchema>;

/** Provenance of a single generation step contributing to an asset. */
export const aiProvenanceRecordSchema = z.object({
  aiJobId: uuidSchema,
  capability: z.enum([
    "TEXT_TO_MUSIC",
    "TEXT_TO_VIDEO",
    "IMAGE_TO_VIDEO",
    "TEXT_TO_IMAGE",
    "VOICE",
    "DUBBING",
    "LYRICS",
    "SCRIPT",
    "THUMBNAIL",
    "SHORT_FORM_VIDEO",
  ]),
  providerId: z.string(),
  providerModel: z.string(),
  prompt: z.string().optional(),
  sourceAssetIds: z.array(uuidSchema).default([]),
  voiceSubjectUserId: uuidSchema.nullable().default(null),
  likenessSubjectUserId: uuidSchema.nullable().default(null),
});
export type AiProvenanceRecord = z.infer<typeof aiProvenanceRecordSchema>;

export const assetSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  workspaceId: uuidSchema,
  creatorId: uuidSchema,
  type: assetTypeSchema,
  title: z.string().min(1).max(300),
  status: assetStatusSchema.default("DRAFT"),
  source: assetSourceSchema,
  storagePath: z.string().nullable().default(null),
  durationSeconds: z.number().nonnegative().nullable().default(null),
  provenance: z.array(aiProvenanceRecordSchema).default([]),
  territories: z.array(territorySchema).default(["WORLDWIDE"]),
  commercialUseAuthorized: z.boolean().default(false),
  publishedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
});
export type Asset = z.infer<typeof assetSchema>;

export const contributorRoleSchema = z.enum([
  "PRIMARY_ARTIST",
  "FEATURED_ARTIST",
  "PRODUCER",
  "WRITER",
  "COMPOSER",
  "PERFORMER",
  "EDITOR",
  "OTHER",
]);
export type ContributorRole = z.infer<typeof contributorRoleSchema>;

/** A named contributor on an asset and their share of revenue. */
export const contributorSchema = z.object({
  id: uuidSchema,
  assetId: uuidSchema,
  organizationId: uuidSchema,
  userId: uuidSchema.nullable().default(null),
  displayName: z.string().min(1).max(200),
  role: contributorRoleSchema,
  revenueSplitBps: z.number().int().min(0).max(10_000),
  createdAt: z.string().datetime(),
});
export type Contributor = z.infer<typeof contributorSchema>;

export const rightsTypeSchema = z.enum(["MASTER", "PUBLISHING"]);
export type RightsType = z.infer<typeof rightsTypeSchema>;

export const rightsDeclarationSchema = z.object({
  id: uuidSchema,
  assetId: uuidSchema,
  organizationId: uuidSchema,
  rightsType: rightsTypeSchema,
  ownerUserId: uuidSchema,
  ownershipPct: z.number().min(0).max(100),
  createdAt: z.string().datetime(),
});
export type RightsDeclaration = z.infer<typeof rightsDeclarationSchema>;

export const licenseTypeSchema = z.enum(["SYNC", "COVER", "SAMPLE", "DISTRIBUTION", "CUSTOM"]);
export type LicenseType = z.infer<typeof licenseTypeSchema>;

export const licenseGrantSchema = z.object({
  id: uuidSchema,
  assetId: uuidSchema,
  organizationId: uuidSchema,
  licenseType: licenseTypeSchema,
  licenseeName: z.string().min(1).max(200),
  territories: z.array(territorySchema).default(["WORLDWIDE"]),
  commercialUse: z.boolean(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
});
export type LicenseGrant = z.infer<typeof licenseGrantSchema>;

export const consentSubjectTypeSchema = z.enum(["VOICE", "LIKENESS"]);
export type ConsentSubjectType = z.infer<typeof consentSubjectTypeSchema>;

/**
 * Explicit, revocable consent granted by the person whose voice or likeness
 * is used. Required before any AI job may clone/synthesize that subject.
 */
export const consentRecordSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  subjectType: consentSubjectTypeSchema,
  subjectUserId: uuidSchema,
  grantedByUserId: uuidSchema,
  scope: z.enum(["ORGANIZATION_ONLY", "SPECIFIC_ASSETS"]),
  assetIdScope: z.array(uuidSchema).default([]),
  revokedAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
});
export type ConsentRecord = z.infer<typeof consentRecordSchema>;
