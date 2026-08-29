import { redirect } from "next/navigation";
import { getCreatorBalance } from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { getCreatorSession } from "@/lib/session";
import { requestPayoutAction } from "./actions";

interface DashboardPageProps {
  searchParams: Promise<{ paid?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  const { paid } = await searchParams;
  const { pool } = getDmtvContext();
  const balance = await getCreatorBalance(pool, session.organizationId, session.creatorId);
  const dollars = (balance.amountMinorUnits / 100).toFixed(2);

  return (
    <main>
      <h1>Creator dashboard</h1>
      {paid && (
        <div className="card">
          <p>✅ Payout requested and settled via FlowraPay.</p>
        </div>
      )}
      <div className="card">
        <p className="muted">Available balance</p>
        <h2>
          ${dollars} {balance.currency}
        </h2>
        {balance.amountMinorUnits > 0 ? (
          <form action={requestPayoutAction}>
            <input type="hidden" name="amountMinorUnits" value={balance.amountMinorUnits} />
            <button type="submit">Request payout of ${dollars}</button>
          </form>
        ) : (
          <p className="muted">No balance available yet -- sell something first.</p>
        )}
      </div>
    </main>
  );
}
