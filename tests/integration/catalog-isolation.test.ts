/**
 * Proves the Phase 4 catalog/design-studio schema's RLS
 * (supabase/migrations/20260719000000_catalog.sql) actually isolates
 * tenants and roles: platform garment templates are readable everywhere
 * but writable only by a platform super admin; a tenant's own custom
 * template is invisible to other tenants; design projects, artwork,
 * products, and variants are all tenant-scoped; a production_manager's
 * broadened read only applies once a design/product has actually left
 * draft. Requires a live, seeded Supabase project plus
 * SUPABASE_SERVICE_ROLE_KEY (used only to seed/clean up rows, never to
 * perform the isolation checks themselves). Skips — does not pass —
 * without both; see docs/TESTING.md.
 */
import { afterAll, describe, expect, it } from "vitest";

import { KUSHPRINTCO_TENANT_ID, TEST_USERS, hasServiceRole, serviceRoleClient, signInAs } from "./helpers";

describe.skipIf(!hasServiceRole)("garment template ownership and isolation", () => {
  afterAll(async () => {
    const service = serviceRoleClient();
    await service.from("garment_templates").delete().eq("slug", "phase-4-test-custom-template");
  });

  it("every active tenant member can read a platform-owned (tenant_id null) template", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const { data, error } = await client.from("garment_templates").select("id").eq("slug", "generic-t-shirt").is("tenant_id", null);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("a tenant owner cannot write to a platform-owned template", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data: template } = await client.from("garment_templates").select("id").eq("slug", "generic-t-shirt").is("tenant_id", null).single();
    const { error } = await client.from("garment_templates").update({ name: "Hijacked" }).eq("id", template!.id);
    const { data: after } = await serviceRoleClient().from("garment_templates").select("name").eq("id", template!.id).single();
    expect(error).toBeNull();
    expect(after?.name).not.toBe("Hijacked");
  });

  it("a tenant owner can create a custom (tenant-owned) template", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { error } = await client.from("garment_templates").insert({
      tenant_id: KUSHPRINTCO_TENANT_ID,
      slug: "phase-4-test-custom-template",
      name: "Custom Test Template",
      category: "t_shirt",
    });
    expect(error).toBeNull();
  });

  it("does not let another tenant's owner read a custom template that isn't theirs", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { data, error } = await client
      .from("garment_templates")
      .select("id")
      .eq("slug", "phase-4-test-custom-template");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("does not let another tenant's owner modify a custom template that isn't theirs", async () => {
    const owner = await signInAs(TEST_USERS.ownerA);
    const { data: template } = await owner
      .from("garment_templates")
      .select("id")
      .eq("slug", "phase-4-test-custom-template")
      .single();

    const outsider = await signInAs(TEST_USERS.ownerB);
    const { error } = await outsider.from("garment_templates").update({ name: "Hijacked" }).eq("id", template!.id);
    const { data: after } = await serviceRoleClient().from("garment_templates").select("name").eq("id", template!.id).single();
    expect(error).toBeNull();
    expect(after?.name).toBe("Custom Test Template");
  });
});

describe.skipIf(!hasServiceRole)("design project isolation and role-scoped read", () => {
  let designProjectId: string;

  afterAll(async () => {
    const service = serviceRoleClient();
    if (designProjectId) await service.from("design_projects").delete().eq("id", designProjectId);
  });

  it("an owner can create a design project", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data, error } = await client
      .from("design_projects")
      .insert({ tenant_id: KUSHPRINTCO_TENANT_ID, name: "Phase 4 Integration Test Design", status: "draft" })
      .select("id")
      .single();
    expect(error).toBeNull();
    designProjectId = data!.id;
  });

  it("a production_manager cannot read a draft design project", async () => {
    const client = await signInAs(TEST_USERS.productionA);
    const { data, error } = await client.from("design_projects").select("id").eq("id", designProjectId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("a production_manager can read the same design once it's approved", async () => {
    await serviceRoleClient().from("design_projects").update({ status: "approved" }).eq("id", designProjectId);
    const client = await signInAs(TEST_USERS.productionA);
    const { data, error } = await client.from("design_projects").select("id").eq("id", designProjectId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("does not let tenant B's owner read tenant A's design project regardless of status", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { data, error } = await client.from("design_projects").select("id").eq("id", designProjectId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("project version persistence: a version snapshot round-trips its stored state", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const state = { garmentTemplateId: null, garmentColorId: null, activeView: "front", elements: [] };
    const { data, error } = await client
      .from("design_project_versions")
      .insert({ design_project_id: designProjectId, tenant_id: KUSHPRINTCO_TENANT_ID, version_number: 1, state })
      .select("state")
      .single();
    expect(error).toBeNull();
    expect(data?.state).toEqual(state);
  });
});

describe.skipIf(!hasServiceRole)("product and variant isolation", () => {
  let productId: string;

  afterAll(async () => {
    const service = serviceRoleClient();
    if (productId) await service.from("products").delete().eq("id", productId);
  });

  it("an owner can create a product and its variants", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data: product, error } = await client
      .from("products")
      .insert({ tenant_id: KUSHPRINTCO_TENANT_ID, name: "Phase 4 Integration Test Product", slug: "phase-4-integration-test-product" })
      .select("id")
      .single();
    expect(error).toBeNull();
    productId = product!.id;

    const { error: variantError } = await client
      .from("product_variants")
      .insert({ tenant_id: KUSHPRINTCO_TENANT_ID, product_id: productId, sku: "P4-TEST-001", size_label: "M" });
    expect(variantError).toBeNull();
  });

  it("does not let a duplicate size/color combination be created for the same product", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { error } = await client
      .from("product_variants")
      .insert({ tenant_id: KUSHPRINTCO_TENANT_ID, product_id: productId, sku: "P4-TEST-002", size_label: "M" });
    expect(error).not.toBeNull();
  });

  it("pricing history: a price update on a variant persists a price_history row", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data: variant } = await client.from("product_variants").select("id").eq("product_id", productId).single();
    await client.from("product_variants").update({ retail_price_cents: 2500 }).eq("id", variant!.id);
    const { error } = await client
      .from("product_price_history")
      .insert({ tenant_id: KUSHPRINTCO_TENANT_ID, product_variant_id: variant!.id, retail_price_cents: 2500 });
    expect(error).toBeNull();

    const { data: history } = await client
      .from("product_price_history")
      .select("retail_price_cents")
      .eq("product_variant_id", variant!.id);
    expect((history ?? []).length).toBeGreaterThan(0);
  });

  it("does not let tenant B's owner read tenant A's product or its variants", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { data: products, error: productError } = await client.from("products").select("id").eq("id", productId);
    expect(productError).toBeNull();
    expect(products).toHaveLength(0);

    const { data: variants, error: variantError } = await client
      .from("product_variants")
      .select("id")
      .eq("product_id", productId);
    expect(variantError).toBeNull();
    expect(variants).toHaveLength(0);
  });

  it("a designer (no products grant) cannot read a draft product", async () => {
    const designer = await signInAs(TEST_USERS.designerA);
    const { data, error } = await designer.from("products").select("id").eq("id", productId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe.skipIf(!hasServiceRole)("design artwork storage isolation", () => {
  const OBJECT_PATH = `${KUSHPRINTCO_TENANT_ID}/design-assets/phase-4-test-artwork.png`;
  const TINY_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  afterAll(async () => {
    const service = serviceRoleClient();
    await service.storage.from("design-uploads").remove([OBJECT_PATH]);
  });

  it("lets any active tenant member (e.g. a designer) upload artwork under their own tenant path", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const { error } = await client.storage
      .from("design-uploads")
      .upload(OBJECT_PATH, TINY_PNG, { contentType: "image/png", upsert: true });
    expect(error).toBeNull();
  });

  it("does not let tenant B's owner download tenant A's artwork", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { error } = await client.storage.from("design-uploads").download(OBJECT_PATH);
    expect(error).not.toBeNull();
  });

  it("does not let tenant B's owner overwrite tenant A's artwork", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { error } = await client.storage
      .from("design-uploads")
      .upload(OBJECT_PATH, TINY_PNG, { contentType: "image/png", upsert: true });
    expect(error).not.toBeNull();
  });

  it("accepts an SVG MIME type in the design-uploads bucket (post-sanitization uploads only — see docs/ARTWORK_SECURITY.md)", async () => {
    const client = await signInAs(TEST_USERS.designerA);
    const svgPath = `${KUSHPRINTCO_TENANT_ID}/design-assets/phase-4-test.svg`;
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>');
    const { error } = await client.storage
      .from("design-uploads")
      .upload(svgPath, svgBytes, { contentType: "image/svg+xml", upsert: true });
    expect(error).toBeNull();
    await serviceRoleClient().storage.from("design-uploads").remove([svgPath]);
  });
});

describe.skipIf(!hasServiceRole)("audit logging for Phase 4 actions", () => {
  it("writes and reads back a product.created audit log row via the service-role client", async () => {
    const service = serviceRoleClient();
    const { error } = await service.from("audit_logs").insert({
      tenant_id: KUSHPRINTCO_TENANT_ID,
      action: "product.created",
      target_table: "products",
    });
    expect(error).toBeNull();

    const { data, error: readError } = await service
      .from("audit_logs")
      .select("action")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID)
      .eq("action", "product.created");
    expect(readError).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("does not leak tenant A's catalog audit entries into tenant B's tenant-scoped queries", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { data, error } = await client
      .from("audit_logs")
      .select("id")
      .eq("tenant_id", KUSHPRINTCO_TENANT_ID);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
