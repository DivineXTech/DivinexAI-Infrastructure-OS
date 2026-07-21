import type { Queryable } from "./db.js";

export interface FeatureFlagCheckInput {
  tenantId: string;
  key: string;
}

/**
 * Tenant-aware feature flag lookup: a tenant-specific override (if one
 * exists) wins; otherwise falls back to the platform-wide default
 * (`tenant_id is null`); otherwise defaults to disabled. This is the same
 * precedence encoded in the `feature_flags_select` RLS policy — this
 * service just gives it a typed, reusable entry point for server code.
 */
export interface FeatureFlagService {
  isEnabled(input: FeatureFlagCheckInput): Promise<boolean>;
}

export class PgFeatureFlagService implements FeatureFlagService {
  constructor(private readonly db: Queryable) {}

  async isEnabled({ tenantId, key }: FeatureFlagCheckInput): Promise<boolean> {
    const tenantRow = await this.db.query<{ enabled: boolean }>(
      `select enabled from tenant_feature_flags where tenant_id = $1 and key = $2`,
      [tenantId, key],
    );
    if (tenantRow.rows.length > 0) {
      return Boolean(tenantRow.rows[0]!.enabled);
    }

    const platformRow = await this.db.query<{ enabled: boolean }>(
      `select enabled from tenant_feature_flags where tenant_id is null and key = $1`,
      [key],
    );
    return platformRow.rows.length > 0 ? Boolean(platformRow.rows[0]!.enabled) : false;
  }
}
