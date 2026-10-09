import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { AdminRevokeToggle } from "@/components/admin/revoke-toggle";

export const metadata = { title: "Subscribers", robots: { index: false, follow: false } };

const PAGE_SIZE = 25;

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() || undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { subscribers, total } = await getSubscriberStore().listSubscribers({
    search,
    limit: PAGE_SIZE,
    offset,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif-display text-2xl text-paper">Subscribers ({total})</h1>
        <a
          href="/api/admin/export/subscribers"
          className="focus-gold rounded-md border border-gold-400/40 px-3.5 py-2 text-xs font-medium text-gold-300 hover:bg-gold-400/10"
        >
          Export CSV
        </a>
      </div>

      <form method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="focus-gold w-full max-w-sm rounded-md border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-paper placeholder:text-paper-dim/40 outline-none focus:border-gold-400/60"
        />
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs uppercase tracking-wider text-paper-dim/60">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Referral</th>
              <th className="py-2 pr-4">Chapter 12</th>
              <th className="py-2 pr-4">Joined</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id} className="border-b border-hairline/50">
                <td className="py-3 pr-4 text-paper">
                  {subscriber.firstName} {subscriber.lastName ?? ""}
                </td>
                <td className="py-3 pr-4 text-paper-dim">{subscriber.email}</td>
                <td className="py-3 pr-4 text-paper-dim">{subscriber.referralCode}</td>
                <td className="py-3 pr-4 text-paper-dim">
                  {subscriber.chapter12AccessRevoked
                    ? "Revoked"
                    : subscriber.chapter12AccessedAt
                      ? "Read"
                      : "Not yet"}
                </td>
                <td className="py-3 pr-4 text-paper-dim/70">
                  {new Date(subscriber.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 pr-4">
                  <AdminRevokeToggle
                    subscriberId={subscriber.id}
                    revoked={subscriber.chapter12AccessRevoked}
                  />
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-paper-dim/60">
                  No subscribers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center gap-3 text-sm text-paper-dim">
          <a
            href={`?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(Math.max(1, page - 1)) })}`}
            className="focus-gold rounded-md border border-white/10 px-3 py-1.5 hover:border-gold-400/40"
            aria-disabled={page <= 1}
          >
            Previous
          </a>
          <span>
            Page {page} of {totalPages}
          </span>
          <a
            href={`?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(Math.min(totalPages, page + 1)) })}`}
            className="focus-gold rounded-md border border-white/10 px-3 py-1.5 hover:border-gold-400/40"
            aria-disabled={page >= totalPages}
          >
            Next
          </a>
        </div>
      )}
    </div>
  );
}
