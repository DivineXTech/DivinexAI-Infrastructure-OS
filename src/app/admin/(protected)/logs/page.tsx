import { getAuditLogStore } from "@/lib/store/audit-log-store";
import { getEmailLogStore } from "@/lib/store/email-log-store";

export const metadata = { title: "Audit Log", robots: { index: false, follow: false } };

const PAGE_SIZE = 50;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ entries, total }, emailLog] = await Promise.all([
    getAuditLogStore().list({ limit: PAGE_SIZE, offset }),
    getEmailLogStore().list({ limit: 50, offset: 0 }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-paper">Audit log ({total})</h1>
      <p className="mt-2 text-sm text-paper-dim">
        Admin actions: logins, reward decisions, CSV exports, Chapter 12 access changes.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-paper-dim/60">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">Actor</th>
              <th className="py-2 pr-4">Action</th>
              <th className="py-2 pr-4">Target</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-hairline/50">
                <td className="py-3 pr-4 text-paper-dim/70">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-paper">{entry.actor}</td>
                <td className="py-3 pr-4 text-paper-dim">{entry.action}</td>
                <td className="py-3 pr-4 text-paper-dim/70">{entry.target ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-paper-dim/60">
                  No audit log entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center gap-3 text-sm text-paper-dim">
          <a
            href={`?page=${Math.max(1, page - 1)}`}
            className="focus-gold rounded-md border border-white/10 px-3 py-1.5 hover:border-gold-400/40"
          >
            Previous
          </a>
          <span>
            Page {page} of {totalPages}
          </span>
          <a
            href={`?page=${Math.min(totalPages, page + 1)}`}
            className="focus-gold rounded-md border border-white/10 px-3 py-1.5 hover:border-gold-400/40"
          >
            Next
          </a>
        </div>
      )}

      <h2 className="mt-12 font-serif-display text-xl text-paper">
        Email delivery status (last {emailLog.entries.length})
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-paper-dim/60">
              <th className="py-2 pr-4">When</th>
              <th className="py-2 pr-4">To</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {emailLog.entries.map((entry) => (
              <tr key={entry.id} className="border-b border-hairline/50">
                <td className="py-3 pr-4 text-paper-dim/70">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-paper">{entry.toEmail}</td>
                <td className="py-3 pr-4 text-paper-dim">{entry.emailType}</td>
                <td className="py-3 pr-4">
                  {entry.delivered && <span className="text-gold-300">Delivered</span>}
                  {!entry.delivered && entry.simulated && (
                    <span className="text-violet-300">Simulated (no Resend key)</span>
                  )}
                  {!entry.delivered && !entry.simulated && (
                    <span className="text-rose-400">Failed{entry.error ? `: ${entry.error}` : ""}</span>
                  )}
                </td>
              </tr>
            ))}
            {emailLog.entries.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-paper-dim/60">
                  No email activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
