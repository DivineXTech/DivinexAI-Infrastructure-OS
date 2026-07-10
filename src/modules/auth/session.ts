import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Tables } from "@/lib/supabase/types";

export type PlatformRole =
  | "buyer"
  | "creator"
  | "affiliate"
  | "moderator"
  | "support_agent"
  | "finance_admin"
  | "marketplace_admin"
  | "super_admin";

const ADMIN_ROLES: PlatformRole[] = ["super_admin", "marketplace_admin", "moderator", "support_agent", "finance_admin"];

export interface CurrentUser {
  id: string;
  email: string | null;
  profile: Tables<"profiles"> | null;
  roles: PlatformRole[];
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Treat "Supabase not configured" the same as "signed out" so protected
  // routes redirect to /login instead of crashing — real deployments always
  // have Supabase configured, so this only matters for local/dev sandboxes.
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
    roles: (roleRows ?? []).map((r) => r.role as PlatformRole),
  };
}

/**
 * Used from Server Components (pages, layouts, route handlers) AND Server
 * Actions — Next's redirect() works in both. A missing session sends the
 * visitor to /login rather than crashing the page.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isPlatformAdmin(user: Pick<CurrentUser, "roles">): boolean {
  return user.roles.some((role) => ADMIN_ROLES.includes(role));
}

/**
 * Redirects a signed-out caller to /login like requireUser(), but throws
 * for a signed-in caller who isn't an admin — used inside server actions
 * where a non-admin reaching an admin action indicates a bypassed UI guard,
 * not a normal navigation case.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isPlatformAdmin(user)) throw new AuthError("Admin access required.");
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
