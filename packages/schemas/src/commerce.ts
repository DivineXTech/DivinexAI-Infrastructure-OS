import { z } from "zod";
import { moneySchema, uuidSchema } from "./common";

export const productTypeSchema = z.enum([
  "MEMBERSHIP",
  "DIGITAL_DOWNLOAD",
  "TIP",
  "PPV",
  "LICENSE",
]);
export type ProductType = z.infer<typeof productTypeSchema>;

export const productSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  workspaceId: uuidSchema,
  creatorId: uuidSchema,
  assetId: uuidSchema.nullable().default(null),
  type: productTypeSchema,
  name: z.string().min(1).max(200),
  price: moneySchema,
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
});
export type Product = z.infer<typeof productSchema>;

export const membershipStatusSchema = z.enum(["ACTIVE", "CANCELED", "EXPIRED"]);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const membershipSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  productId: uuidSchema,
  fanId: uuidSchema,
  status: membershipStatusSchema,
  startedAt: z.string().datetime(),
  renewsAt: z.string().datetime().nullable().default(null),
  canceledAt: z.string().datetime().nullable().default(null),
});
export type Membership = z.infer<typeof membershipSchema>;

export const orderStatusSchema = z.enum(["PENDING", "COMPLETED", "REFUNDED", "FAILED"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** A single purchase of a product by a fan. Immutable once COMPLETED. */
export const orderSchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  workspaceId: uuidSchema,
  productId: uuidSchema,
  creatorId: uuidSchema,
  fanId: uuidSchema,
  status: orderStatusSchema,
  grossAmount: moneySchema,
  idempotencyKey: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
});
export type Order = z.infer<typeof orderSchema>;
