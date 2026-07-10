import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/modules/auth/session";
import { getCreatorMembershipForUser, canManageTeam } from "@/modules/creators/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { inviteTeamMemberAction, removeTeamMemberAction } from "@/modules/team/actions";

export default async function DashboardSettingsPage() {
  const user = await requireUser();
  const membership = await getCreatorMembershipForUser(user.id);
  if (!membership) return null;

  const supabase = await createSupabaseServerClient();
  const { data: members } = await supabase
    .from("creator_members")
    .select("id, role, user_id, accepted_at")
    .eq("creator_id", membership.creator.id)
    .order("created_at");

  const memberProfiles = members?.length
    ? await supabase.from("profiles").select("id, username, display_name").in("id", members.map((m) => m.user_id))
    : { data: [] };

  const profileById = new Map((memberProfiles.data ?? []).map((p) => [p.id, p]));
  const canManage = canManageTeam(membership.role);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="font-display text-2xl font-medium text-ink">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>Roles are enforced on the server and in the database — not just hidden in the UI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="divide-y divide-border">
            {(members ?? []).map((member) => {
              const profile = profileById.get(member.user_id);
              return (
                <li key={member.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium text-ink">{profile?.display_name ?? profile?.username ?? "Unknown"}</p>
                    <p className="text-xs text-ink-muted">@{profile?.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{member.role.replace(/_/g, " ")}</Badge>
                    {canManage && member.role !== "owner" ? (
                      <form action={removeTeamMemberAction}>
                        <input type="hidden" name="memberId" value={member.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {canManage ? (
            <form action={inviteTeamMemberAction} className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" placeholder="teammate-username" required minLength={3} />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select id="role" name="role" defaultValue="product_manager">
                  <option value="administrator">Administrator</option>
                  <option value="product_manager">Product manager</option>
                  <option value="marketing_manager">Marketing manager</option>
                  <option value="support_agent">Support agent</option>
                  <option value="analyst">Analyst</option>
                  <option value="finance_viewer">Finance viewer</option>
                </Select>
              </div>
              <Button type="submit" className="col-span-3">
                Add team member
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
