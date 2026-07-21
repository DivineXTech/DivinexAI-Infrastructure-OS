import type { Queryable } from "./db.js";
import type { ActorType, SecuritySeverity } from "./types.js";

/**
 * `audit_events` and `security_events` have no INSERT policy for the
 * `authenticated` role (see
 * `supabase/migrations/20260721000002_audit_security_events.sql`) — deny by
 * default means no end-user request can write one, no matter what
 * permissions they hold. These functions must only ever be called with a
 * service-role-equivalent connection (a direct owner/service-role Postgres
 * connection). This protects audit-log integrity (source brief: defend
 * against audit-log tampering).
 */

export interface RecordAuditEventInput {
  tenantId: string | null;
  actorUserId: string | null;
  actorType: ActorType;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(db: Queryable, input: RecordAuditEventInput): Promise<void> {
  await db.query(
    `insert into audit_events
       (tenant_id, actor_user_id, actor_type, event_type, resource_type, resource_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.tenantId,
      input.actorUserId,
      input.actorType,
      input.eventType,
      input.resourceType ?? null,
      input.resourceId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export interface RecordSecurityEventInput {
  tenantId: string | null;
  actorUserId: string | null;
  severity: SecuritySeverity;
  eventType: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function recordSecurityEvent(
  db: Queryable,
  input: RecordSecurityEventInput,
): Promise<void> {
  await db.query(
    `insert into security_events
       (tenant_id, actor_user_id, severity, event_type, description, metadata)
     values ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.tenantId,
      input.actorUserId,
      input.severity,
      input.eventType,
      input.description,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
