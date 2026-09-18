/**
 * Proves Supabase Storage RLS (supabase/migrations/20260716000000_storage.sql)
 * actually isolates tenants: a member of tenant A cannot read or overwrite
 * an object stored under tenant B's path, in a private bucket. Requires a
 * live, seeded Supabase project plus SUPABASE_SERVICE_ROLE_KEY (used only
 * to seed/clean up the test object — never to perform the isolation
 * checks themselves, which run as ordinary tenant members). Skips (does
 * not pass) without both.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  KUSHPRINTCO_TENANT_ID,
  TEST_USERS,
  hasServiceRole,
  serviceRoleClient,
  signInAs,
} from "./helpers";

const BUCKET = "design-uploads";
const OBJECT_PATH = `${KUSHPRINTCO_TENANT_ID}/phase-1-5-storage-test.png`;
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe.skipIf(!hasServiceRole)("storage isolation", () => {
  beforeAll(async () => {
    const service = serviceRoleClient();
    const { error } = await service.storage
      .from(BUCKET)
      .upload(OBJECT_PATH, TINY_PNG, { contentType: "image/png", upsert: true });
    if (error) throw error;
  });

  afterAll(async () => {
    const service = serviceRoleClient();
    await service.storage.from(BUCKET).remove([OBJECT_PATH]);
  });

  it("lets tenant A's owner download an object under tenant A's path", async () => {
    const client = await signInAs(TEST_USERS.ownerA);
    const { data, error } = await client.storage.from(BUCKET).download(OBJECT_PATH);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("does not let tenant B's owner download an object under tenant A's path", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { error } = await client.storage.from(BUCKET).download(OBJECT_PATH);
    expect(error).not.toBeNull();
  });

  it("does not let tenant B's owner overwrite an object under tenant A's path", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { error } = await client.storage
      .from(BUCKET)
      .upload(OBJECT_PATH, TINY_PNG, { contentType: "image/png", upsert: true });
    expect(error).not.toBeNull();
  });

  it("does not let tenant B's owner write a new object under tenant A's path", async () => {
    const client = await signInAs(TEST_USERS.ownerB);
    const { error } = await client.storage
      .from(BUCKET)
      .upload(`${KUSHPRINTCO_TENANT_ID}/attempted-cross-tenant-write.png`, TINY_PNG, {
        contentType: "image/png",
      });
    expect(error).not.toBeNull();
  });
});
