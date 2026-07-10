"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser, canManageTeam } from "@/modules/creators/service";
import { writeAuditLog } from "@/modules/audit/log";

const inviteSchema = z.object({
  username: z.string().min(3).max(30),
  role: z.enum(["administrator", "product_manager", "marketing_manager", "support_agent", "analyst", "finance_viewer"]),
});

export async function inviteTeamMemberAction(formData: FormData) {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership || !canManageTeam(membership.role)) throw new Error("You don't have permission to manage the team.");

  const parsed = inviteSchema.parse({ username: formData.get("username"), role: formData.get("role") });

  const supabase = await createSupabaseServerClient();
  const { data: invitee } = await supabase.from("profiles").select("id").eq("username", parsed.username.toLowerCase()).maybeSingle();
  if (!invitee) throw new Error("No FlowraMarket account found with that username.");

  const { error } = await supabase.from("creator_members").insert({
    creator_id: membership.creator.id,
    user_id: invitee.id,
    role: parsed.role,
    invited_by: user.id,
    accepted_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") throw new Error("This person is already on your team.");
    throw new Error(error.message);
  }

  await writeAuditLog({ actorId: user.id, action: "team.member_invited", entityType: "creator_account", entityId: membership.creator.id, metadata: { invitedUserId: invitee.id, role: parsed.role } });
  revalidatePath("/dashboard/settings");
}

export async function removeTeamMemberAction(formData: FormData) {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership || !canManageTeam(membership.role)) throw new Error("You don't have permission to manage the team.");

  const memberId = z.string().uuid().parse(formData.get("memberId"));
  const supabase = await createSupabaseServerClient();
  await supabase.from("creator_members").delete().eq("id", memberId).eq("creator_id", membership.creator.id).neq("role", "owner");
  revalidatePath("/dashboard/settings");
}
