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
  // Two entries, same email, different tenant — exercises "a user
  // belonging to two tenants receives exactly their own two memberships"
  // (tests/integration/membership-isolation.test.ts). The second entry's
  // createUser call hits the "already registered" branch below and reuses
  // the same profileId, then inserts a second, distinct tenant_memberships
  // row for it.
  {
    email: "multi-tenant@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo Multi-Tenant Member",
    tenantId: KUSHPRINTCO_TENANT_ID,
    roleKey: "designer",
  },
  {
    email: "multi-tenant@demo.kushprintco.local",
    password: "demo-password-123!",
    fullName: "Demo Multi-Tenant Member",
    tenantId: ISOLATION_TENANT_ID,
    roleKey: "tenant_owner",
  },
];

async function main() {
  const { data: roles, error: rolesError } = await admin
    .from("roles")
    .select("id, key");
  if (rolesError) throw rolesError;
  const roleIdByKey = new Map(roles.map((r) => [r.key, r.id]));

  let ownerProfileId: string | null = null;
  let designerProfileId: string | null = null;

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

    if (user.email === "owner@demo.kushprintco.local") ownerProfileId = profileId;
    if (user.email === "designer@demo.kushprintco.local") designerProfileId = profileId;
  }

  if (ownerProfileId) {
    await seedCatalogDemoData(ownerProfileId, designerProfileId ?? ownerProfileId);
  }

  console.log("\nDemo seed complete. All demo accounts share the password:");
  console.log("  demo-password-123!");
}

/**
 * Phase 4 demo data: one draft design, one approved design (with a
 * couple of elements/placements), and one product draft with generated
 * variants — enough to see every catalog/design-studio page populated
 * without an empty state. Runs after demo users exist, since
 * design_projects.owner_profile_id/assigned_designer_id reference real
 * profiles that only exist post-auth-seed. Idempotent: re-running skips
 * cleanly if the demo design projects already exist (checked by name).
 */
async function seedCatalogDemoData(ownerProfileId: string, designerProfileId: string) {
  const { data: template } = await admin
    .from("garment_templates")
    .select("id")
    .eq("slug", "generic-t-shirt")
    .is("tenant_id", null)
    .maybeSingle();
  if (!template) {
    console.log("Skipping Phase 4 demo data — generic-t-shirt template not found (run supabase db reset first).");
    return;
  }

  const { data: color } = await admin
    .from("garment_template_colors")
    .select("id")
    .eq("garment_template_id", template.id)
    .eq("name", "Black")
    .maybeSingle();

  const { data: existingDraft } = await admin
    .from("design_projects")
    .select("id")
    .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
    .eq("name", "Demo Draft Design")
    .maybeSingle();
  if (!existingDraft) {
    const { error } = await admin.from("design_projects").insert({
      tenant_id: KUSHPRINTCO_TENANT_ID,
      name: "Demo Draft Design",
      status: "draft",
      garment_template_id: template.id,
      garment_color_id: color?.id ?? null,
      owner_profile_id: ownerProfileId,
      assigned_designer_id: designerProfileId,
    });
    if (error) throw error;
    console.log("Seeded demo draft design project");
  }

  const { data: existingApproved } = await admin
    .from("design_projects")
    .select("id")
    .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
    .eq("name", "Demo Approved Design")
    .maybeSingle();

  let approvedProjectId = existingApproved?.id as string | undefined;
  if (!approvedProjectId) {
    const { data: inserted, error } = await admin
      .from("design_projects")
      .insert({
        tenant_id: KUSHPRINTCO_TENANT_ID,
        name: "Demo Approved Design",
        status: "approved",
        garment_template_id: template.id,
        garment_color_id: color?.id ?? null,
        production_method: "dtf",
        owner_profile_id: ownerProfileId,
        assigned_designer_id: designerProfileId,
      })
      .select("id")
      .single();
    if (error) throw error;
    approvedProjectId = inserted.id;

    const { data: element, error: elementError } = await admin
      .from("design_elements")
      .insert({
        tenant_id: KUSHPRINTCO_TENANT_ID,
        design_project_id: approvedProjectId,
        element_type: "text",
        z_index: 1,
        text_content: "KUSHPRINTCO",
        font_key: "sans",
        font_size: 28,
        text_color: "#ffffff",
        text_align: "center",
      })
      .select("id")
      .single();
    if (elementError) throw elementError;

    const { error: placementError } = await admin.from("design_placements").insert({
      design_element_id: element.id,
      tenant_id: KUSHPRINTCO_TENANT_ID,
      garment_view: "front",
      x: 30,
      y: 40,
      width: 40,
      height: 15,
      rotation: 0,
    });
    if (placementError) throw placementError;
    console.log("Seeded demo approved design project with one text element");
  }

  const { data: existingProduct } = await admin
    .from("products")
    .select("id")
    .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
    .eq("slug", "demo-product-draft")
    .maybeSingle();
  if (!existingProduct) {
    const { data: product, error } = await admin
      .from("products")
      .insert({
        tenant_id: KUSHPRINTCO_TENANT_ID,
        name: "Demo Product Draft",
        slug: "demo-product-draft",
        category: "t_shirt",
        garment_template_id: template.id,
        production_method: "dtf",
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: variantsError } = await admin.from("product_variants").insert([
      { tenant_id: KUSHPRINTCO_TENANT_ID, product_id: product.id, sku: "DEMO-001", size_label: "M", color_name: "Black" },
      { tenant_id: KUSHPRINTCO_TENANT_ID, product_id: product.id, sku: "DEMO-002", size_label: "L", color_name: "Black" },
    ]);
    if (variantsError) throw variantsError;
    console.log("Seeded demo product draft with 2 variants");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
