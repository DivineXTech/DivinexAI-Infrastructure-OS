import type { Queryable } from "./db.js";
import type { TenantAccessEvaluator } from "./policy.js";
import { TenantAuthorizationError } from "./tenant.js";

export interface UpdateTenantSettingsInput {
  tenantId: string;
  userId: string;
  patch: Record<string, unknown>;
}

export interface TenantSettingsService {
  get(tenantId: string): Promise<Record<string, unknown>>;
  update(input: UpdateTenantSettingsInput): Promise<void>;
}

/**
 * Direct-Postgres implementation. `update` explicitly re-checks the
 * `tenant.manage` permission via the injected `TenantAccessEvaluator`
 * before writing, rather than relying solely on RLS — required for
 * service-role-equivalent callers (rule #8), and harmless double coverage
 * when the underlying connection is itself RLS-restricted.
 */
export class PgTenantSettingsService implements TenantSettingsService {
  constructor(
    private readonly db: Queryable,
    private readonly access: TenantAccessEvaluator,
  ) {}

  async get(tenantId: string): Promise<Record<string, unknown>> {
    const { rows } = await this.db.query<{ settings: Record<string, unknown> }>(
      `select settings from tenant_settings where tenant_id = $1`,
      [tenantId],
    );
    return rows[0]?.settings ?? {};
  }

  async update({
    tenantId,
    userId,
    patch,
  }: UpdateTenantSettingsInput): Promise<void> {
    const decision = await this.access.checkPermission({
      tenantId,
      userId,
      permissionKey: "tenant.manage",
    });
    if (!decision.allowed) {
      throw new TenantAuthorizationError(decision.reason);
    }

    await this.db.query(
      `insert into tenant_settings (tenant_id, settings, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (tenant_id) do update
         set settings = tenant_settings.settings || excluded.settings,
             updated_at = now()`,
      [tenantId, JSON.stringify(patch)],
    );
  }
}
