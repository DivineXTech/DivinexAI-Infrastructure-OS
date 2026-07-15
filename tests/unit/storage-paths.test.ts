import { describe, expect, it } from "vitest";

import { buildTenantObjectPath, sanitizeFilename } from "@/lib/storage/paths";

describe("sanitizeFilename", () => {
  it("keeps a normal filename intact", () => {
    expect(sanitizeFilename("front-mockup_v2.png")).toBe("front-mockup_v2.png");
  });

  it("strips directory components", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\windows\\system32\\evil.dll")).toBe("evil.dll");
  });

  it("replaces unsafe characters", () => {
    expect(sanitizeFilename("weird name!@#.png")).toBe("weird_name___.png");
  });

  it("never returns an empty string", () => {
    expect(sanitizeFilename("...")).toBe("file");
    expect(sanitizeFilename("")).toBe("file");
  });
});

describe("buildTenantObjectPath", () => {
  const tenantId = "11111111-1111-1111-1111-111111111111";

  it("prefixes the tenant id as the first segment", () => {
    expect(buildTenantObjectPath(tenantId, "logo.png")).toBe(`${tenantId}/logo.png`);
  });

  it("sanitizes every segment, so traversal attempts collapse to plain filenames", () => {
    expect(buildTenantObjectPath(tenantId, "../other-tenant-id", "secret.png")).toBe(
      `${tenantId}/other-tenant-id/secret.png`,
    );
  });

  it("flattens embedded slashes/backslashes in a single segment", () => {
    expect(buildTenantObjectPath(tenantId, "a/b\\c.png")).toBe(`${tenantId}/a/b/c.png`);
  });

  it("throws when given no usable segments", () => {
    expect(() => buildTenantObjectPath(tenantId, "..", "///")).toThrow();
  });
});
