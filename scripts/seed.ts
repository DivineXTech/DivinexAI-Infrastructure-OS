/**
 * Development seed script. Creates demo auth users + tenant memberships for
 * local testing, including a second tenant used purely to prove cross-tenant
 * isolation (see docs/SECURITY.md). Never run this against production — it
 * is intentionally not wired into any production build or deploy step.
 *
 * Usage: npm run seed  (requires SUPABASE_SERVICE_ROLE_KEY + SEED_MODE_ENABLED=true
 * in .env.local — see .env.example)
 */
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadDotenv({ path: ".env.local" });

// Two independent gates, both required — this must not run from a slip of
// NODE_ENV alone, and it must not run just because service-role
// credentials happen to be present.
if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run the seed script with NODE_ENV=production.");
  process.exit(1);
}
if (process.env.SEED_MODE_ENABLED !== "true") {
  console.error(
    "Refusing to run: SEED_MODE_ENABLED is not \"true\". Set SEED_MODE_ENABLED=true in .env.local to allow seeding (see .env.example).",
  );
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See .env.example.",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const KUSHPRINTCO_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const ISOLATION_TENANT_ID = "22222222-2222-2222-2222-222222222222";

type DemoUser = {
  email: string;
  password: string;
  fullName: string;
  /** Omit to create the auth user + profile with no tenant membership at
   * all — used to test the "no tenant yet" onboarding redirect path. */
  tenantId?: string;
  roleKey?: string;
};

const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo Platform Admin",
    tenantId: KUSHPRINTCO_TENANT_ID,
    roleKey: "platform_super_admin",
  },
  {
    email: "owner@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo Tenant Owner",
    tenantId: KUSHPRINTCO_TENANT_ID,
    roleKey: "tenant_owner",
  },
  {
    email: "designer@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo Designer",
    tenantId: KUSHPRINTCO_TENANT_ID,
    roleKey: "designer",
  },
  {
    email: "production@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo Production Manager",
    tenantId: KUSHPRINTCO_TENANT_ID,
    roleKey: "production_manager",
  },
  {
    email: "customer@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo Customer",
    tenantId: KUSHPRINTCO_TENANT_ID,
    roleKey: "customer",
  },
  {
    email: "owner@demo.isolation-tenant.local",
    password: "demo-password-123!",
    fullName: "Demo Isolation Tenant Owner",
    tenantId: ISOLATION_TENANT_ID,
    roleKey: "tenant_owner",
  },
  {
    email: "no-tenant@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo User Without A Tenant",
    // No tenantId/roleKey: exercises the /app/onboarding redirect and the
    // "user without tenant membership" authentication-validation case.
  },
];

async function main() {
  const { data: roles, error: rolesError } = await admin
    .from("roles")
    .select("id, key");
  if (rolesError) throw rolesError;
  const roleIdByKey = new Map(roles.map((r) => [r.key, r.id]));

  for (const user of DEMO_USERS) {
    const roleId = user.roleKey ? roleIdByKey.get(user.roleKey) : undefined;
    if (user.roleKey && !roleId) {
      throw new Error(
        `Role "${user.roleKey}" not found. Run the base migration + seed.sql first.`,
      );
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
      });

    let profileId: string;
    if (createError) {
      if (!createError.message.includes("already been registered")) {
        throw createError;
      }
      const { data: existing, error: listError } =
        await admin.auth.admin.listUsers();
      if (listError) throw listError;
      const match = existing.users.find((u) => u.email === user.email);
      if (!match) throw new Error(`Could not resolve existing user ${user.email}`);
      profileId = match.id;
    } else {
      profileId = created.user.id;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: profileId,
      full_name: user.fullName,
      is_platform_super_admin: user.roleKey === "platform_super_admin",
    });
    if (profileError) throw profileError;

    if (user.tenantId && roleId) {
      const { error: membershipError } = await admin
        .from("tenant_memberships")
        .upsert(
          {
            tenant_id: user.tenantId,
            profile_id: profileId,
            role_id: roleId,
            status: "active",
          },
          { onConflict: "tenant_id,profile_id" },
        );
      if (membershipError) throw membershipError;
      console.log(`Seeded ${user.email} (${user.roleKey}) on tenant ${user.tenantId}`);
    } else {
      console.log(`Seeded ${user.email} (no tenant membership, by design)`);
    }
  }

  console.log("\nDemo seed complete. All demo accounts share the password:");
  console.log("  demo-password-123!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
