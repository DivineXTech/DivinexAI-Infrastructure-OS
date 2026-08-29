import { z } from "zod";
import { creatorPlanTierSchema, uuidSchema } from "./common";

/** Top-level tenant boundary. All tenant-owned tables key off organizationId for RLS. */
export const organizationSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  planTier: creatorPlanTierSchema.default("FREE"),
  createdAt: z.string().datetime(),
});
export type Organization = z.infer<typeof organizationSchema>;

/**
 * A workspace scopes day-to-day operations within an organization (e.g. one
 * creator's operating space). Every tenant-owned row belongs to a workspace,
 * and every workspace belongs to exactly one organization.
 */
export const workspaceSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  name: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const memberRoleSchema = z.enum(["OWNER", "ADMIN", "CONTRIBUTOR", "VIEWER"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const organizationMemberSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  userId: uuidSchema,
  role: memberRoleSchema,
  createdAt: z.string().datetime(),
});
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
