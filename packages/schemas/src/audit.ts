import { z } from "zod";
import { uuidSchema } from "./common";

export const auditLogEntrySchema = z.object({
  id: uuidSchema,
  organizationId: uuidSchema,
  actorUserId: uuidSchema.nullable().default(null),
  action: z.string().min(1).max(120),
  entityType: z.string().min(1).max(120),
  entityId: uuidSchema.nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
});
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
