import { z } from "zod";
import { uuidSchema } from "./common";

export const aiCapabilitySchema = z.enum([
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
]);
export type AiCapability = z.infer<typeof aiCapabilitySchema>;

export const aiJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "REJECTED_CONSENT",
]);
export type AiJobStatus = z.infer<typeof aiJobStatusSchema>;

export const aiJobSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  workspaceId: uuidSchema,
  creatorId: uuidSchema,
  capability: aiCapabilitySchema,
  providerId: z.string().min(1),
  status: aiJobStatusSchema.default("QUEUED"),
  inputPrompt: z.string().nullable().default(null),
  sourceAssetIds: z.array(uuidSchema).default([]),
  voiceSubjectUserId: uuidSchema.nullable().default(null),
  likenessSubjectUserId: uuidSchema.nullable().default(null),
  creditCost: z.number().nonnegative(),
  providerCostMinorUnits: z.number().nonnegative().nullable().default(null),
  outputAssetId: uuidSchema.nullable().default(null),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().default(null),
});
export type AiJob = z.infer<typeof aiJobSchema>;

export const aiCreditLedgerEntrySchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  aiJobId: uuidSchema.nullable().default(null),
  delta: z.number(),
  reason: z.enum(["GRANT", "CONSUMPTION", "REFUND"]),
  createdAt: z.string().datetime(),
});
export type AiCreditLedgerEntry = z.infer<typeof aiCreditLedgerEntrySchema>;
