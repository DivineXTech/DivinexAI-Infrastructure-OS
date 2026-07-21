/**
 * Core tenancy domain types (Phase 1). These mirror the tables created by
 * `supabase/migrations/00000001_core_tenancy.sql` — keep the two in sync by
 * hand; there is no code generator wired up yet.
 */

export type TenantStatus = "active" | "suspended" | "archived";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export type MembershipStatus = "active" | "invited" | "suspended";

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  /** Null for a platform-level role shared across tenants. */
  tenantId: string | null;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
  category: string | null;
}

export interface TenantSettings {
  tenantId: string;
  settings: Record<string, unknown>;
  updatedAt: string;
}

export interface TenantFeatureFlag {
  id: string;
  /** Null for a platform-wide default. */
  tenantId: string | null;
  key: string;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ActorType = "user" | "service" | "agent" | "system";

export interface AuditEvent {
  id: string;
  /** Null for a platform-level event not scoped to a tenant. */
  tenantId: string | null;
  actorUserId: string | null;
  actorType: ActorType;
  eventType: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type SecuritySeverity = "info" | "warning" | "critical";

export interface SecurityEvent {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  severity: SecuritySeverity;
  eventType: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
