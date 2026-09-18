/**
 * Path helpers every future upload code path (design studio, product
 * images, etc. — Phase 4+) must use rather than concatenating strings by
 * hand. Centralizing this is what makes the "no path traversal, no
 * cross-tenant overwrite" guarantee in docs/SECURITY.md actually true —
 * the storage RLS policies (supabase/migrations/20260716000000_storage.sql)
 * trust that the first path segment is a real tenant_id, so nothing
 * upstream of that check may accept a caller-supplied path prefix.
 */

const UNSAFE_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

/**
 * Strips path separators, `..`, and anything that isn't a conservative
 * filename character, so a crafted filename like `../../other-tenant/x`
 * or `..\\..\\etc\\passwd` can't escape the tenant-prefixed folder it's
 * placed into.
 */
export function sanitizeFilename(rawFilename: string): string {
  const base = rawFilename.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(UNSAFE_FILENAME_CHARS, "_").replace(/^\.+/, "");
  const withExtensionLimit = cleaned.slice(0, 200);
  return withExtensionLimit.length > 0 ? withExtensionLimit : "file";
}

/**
 * Builds a storage object path with the tenant id as the mandatory first
 * segment, exactly as the storage RLS policies expect. `tenantId` must
 * come from a trusted server-side membership lookup (e.g.
 * `requireCurrentTenantRole()`), never from client-supplied input, or this
 * function becomes a path-traversal/cross-tenant-write primitive instead
 * of a guard against one.
 */
export function buildTenantObjectPath(
  tenantId: string,
  ...segments: string[]
): string {
  const safeSegments = segments
    .flatMap((segment) => segment.split(/[/\\]/))
    // Drop pure-dot segments ("..", ".") before sanitizing, rather than
    // after — sanitizeFilename() would otherwise turn a rejected ".."
    // into the placeholder "file" and leave it in the path.
    .filter((segment) => segment.length > 0 && !/^\.+$/.test(segment))
    .map((segment) => sanitizeFilename(segment));

  if (safeSegments.length === 0) {
    throw new Error("buildTenantObjectPath requires at least one path segment");
  }

  return [tenantId, ...safeSegments].join("/");
}
