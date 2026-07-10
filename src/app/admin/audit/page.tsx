import { EmptyState } from "@/components/ui/states";
import { formatDate } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminAuditPage() {
  const supabase = await createSupabaseServerClient();
  const { data: logs } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Audit log</h1>
      {!logs || logs.length === 0 ? (
        <EmptyState title="No audit events yet" description="Material admin and commerce actions appear here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-paper-muted text-left text-xs font-medium uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-medium text-ink">{log.action}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {log.entity_type}
                    {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{log.actor_id ? log.actor_id.slice(0, 8) : "system"}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
