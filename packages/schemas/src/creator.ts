import { z } from "zod";
import { uuidSchema } from "./common";

export const creatorOnboardingStepSchema = z.enum([
  "ACCOUNT_CREATED",
  "PROFILE_COMPLETED",
  "PAYOUT_ACCOUNT_LINKED",
  "RIGHTS_ACKNOWLEDGED",
  "COMPLETED",
]);
export type CreatorOnboardingStep = z.infer<typeof creatorOnboardingStepSchema>;

export const creatorProfileSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  workspaceId: uuidSchema,
  userId: uuidSchema,
  displayName: z.string().min(1).max(120),
  handle: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9_]+$/),
  onboardingStep: creatorOnboardingStepSchema.default("ACCOUNT_CREATED"),
  flowraPayAccountId: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
});
export type CreatorProfile = z.infer<typeof creatorProfileSchema>;

export const fanProfileSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema,
  displayName: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
});
export type FanProfile = z.infer<typeof fanProfileSchema>;
