import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function listActivePlans() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("platform_plans").select("*").eq("is_active", true).order("sort_order");
  if (error) throw new Error(`Failed to list plans: ${error.message}`);
  return data ?? [];
}
