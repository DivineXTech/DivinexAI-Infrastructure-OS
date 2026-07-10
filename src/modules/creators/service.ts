import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type CreatorMemberRole =
  | "owner"
  | "administrator"
  | "product_manager"
  | "marketing_manager"
  | "support_agent"
  | "analyst"
  | "finance_viewer";

const MANAGER_ROLES: CreatorMemberRole[] = ["owner", "administrator", "product_manager"];

export interface CreatorMembership {
  creator: Tables<"creator_accounts">;
  role: CreatorMemberRole;
}

/**
 * Returns the caller's creator account and membership role for the given
 * user, using the caller's own (RLS-scoped) session — this never bypasses
 * row-level security, it just shapes the result for the dashboard.
 */
export async function getCreatorMembershipForUser(userId: string): Promise<CreatorMembership | null> {
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("creator_members")
    .select("role, creator_id")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: creator } = await supabase
    .from("creator_accounts")
    .select("*")
    .eq("id", membership.creator_id)
    .maybeSingle();

  if (!creator) return null;

  return { creator, role: membership.role as CreatorMemberRole };
}

export function canManageProducts(role: CreatorMemberRole): boolean {
  return MANAGER_ROLES.includes(role);
}

const STOREFRONT_MANAGER_ROLES: CreatorMemberRole[] = ["owner", "administrator", "marketing_manager"];
const FINANCE_VIEWER_ROLES: CreatorMemberRole[] = ["owner", "administrator", "finance_viewer"];

export function canManageStorefront(role: CreatorMemberRole): boolean {
  return STOREFRONT_MANAGER_ROLES.includes(role);
}

export function canManageTeam(role: CreatorMemberRole): boolean {
  return role === "owner" || role === "administrator";
}

export function canViewFinance(role: CreatorMemberRole): boolean {
  return FINANCE_VIEWER_ROLES.includes(role);
}
