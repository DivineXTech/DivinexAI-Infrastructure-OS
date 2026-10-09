import Link from "next/link";
import { requireAdminSession } from "@/lib/admin/guard";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/campaign", label: "Campaign" },
  { href: "/admin/logs", label: "Audit Log" },
];

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-48 sm:flex-col">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-gold whitespace-nowrap rounded-md px-3 py-2 text-sm text-paper-dim transition-colors hover:bg-white/5 hover:text-paper"
            >
              {item.label}
            </Link>
          ))}
          <form action="/api/admin/logout" method="post" className="mt-2">
            <button
              type="submit"
              className="focus-gold w-full whitespace-nowrap rounded-md px-3 py-2 text-left text-sm text-rose-400 transition-colors hover:bg-rose-500/10"
            >
              Log out
            </button>
          </form>
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
