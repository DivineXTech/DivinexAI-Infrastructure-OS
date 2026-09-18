"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit/log";
import { CURRENT_TENANT_COOKIE, getCurrentProfile } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createTenantSchema } from "@/lib/validation/tenant";

export type CreateTenantResult =
  | { ok: true; tenantSlug: string }
  | { ok: false; error: string; field?: "tenantName" | "tenantSlug" };

/**
 * Creates a new tenant and grants the caller `tenant_owner` on it — the one
 * approved way a signed-up user becomes a tenant owner (see
 * docs/ROLES_AND_PERMISSIONS.md and docs/SECURITY.md "Tenant provisioning").
 *
 * Deliberately narrow trust boundary: the only client-supplied values are
 * `tenantName` and `tenantSlug` (both just strings, validated below). The
 * actor's identity comes from the authenticated session
 * (`getCurrentProfile()`), never from a client-supplied field, and the
 * granted role is hardcoded to `tenant_owner` — there is no code path here
 * that could assign `platform_super_admin` or any other role. RLS blocks
 * ordinary authenticated users from inserting into `tenants` or
 * `tenant_memberships` directly (by design — see the foundation
 * migration), so this trusted server action uses the service-role client
 * to perform the insert, with this function's own logic as the security
 * boundary instead of a database policy.
 */
export async function createTenantAction(
  input: unknown,
): Promise<CreateTenantResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const parsed = createTenantSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid input",
      field: issue?.path[0] as "tenantName" | "tenantSlug" | undefined,
    };
  }
  const { tenantName, tenantSlug } = parsed.data;

  let service;
  try {
    service = createSupabaseServiceRoleClient();
  } catch {
    return {
      ok: false,
      error:
        "Tenant creation isn't available in this environment yet (no Supabase service-role key configured). See docs/DEPLOYMENT.md.",
    };
  }

  const { data: existing, error: lookupError } = await service
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (lookupError) {
    return { ok: false, error: "Could not validate that name. Please try again." };
  }
  if (existing) {
    return {
      ok: false,
      error: "That name is already taken. Please choose another.",
      field: "tenantSlug",
    };
  }

  const { data: ownerRole, error: roleError } = await service
    .from("roles")
    .select("id")
    .eq("key", "tenant_owner")
    .single();
  if (roleError || !ownerRole) {
    return { ok: false, error: "Could not complete setup. Please try again." };
  }

  const { data: tenant, error: tenantError } = await service
    .from("tenants")
    .insert({ slug: tenantSlug, name: tenantName })
    .select("id, slug")
    .single();
  if (tenantError || !tenant) {
    return { ok: false, error: "Could not create your brand. Please try again." };
  }

  const { error: membershipError } = await service.from("tenant_memberships").insert({
    tenant_id: tenant.id,
    profile_id: profile.id,
    role_id: ownerRole.id,
    status: "active",
  });
  if (membershipError) {
    return {
      ok: false,
      error: "Your brand was created but setup didn't finish. Please contact support.",
    };
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorProfileId: profile.id,
    action: "tenant.created",
    targetTable: "tenants",
    targetId: tenant.id,
    metadata: { slug: tenant.slug },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorProfileId: profile.id,
    action: "tenant_membership.created",
    targetTable: "tenant_memberships",
    targetId: profile.id,
    metadata: { roleKey: "tenant_owner", grantedVia: "tenant_creation" },
  });

  const cookieStore = await cookies();
  cookieStore.set(CURRENT_TENANT_COOKIE, tenant.slug, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true, tenantSlug: tenant.slug };
}
