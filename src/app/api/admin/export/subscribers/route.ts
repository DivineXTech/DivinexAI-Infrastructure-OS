import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/admin/guard";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { getAuditLogStore } from "@/lib/store/audit-log-store";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "country",
  "marketingConsent",
  "referralCode",
  "referredBy",
  "chapter12AccessedAt",
  "chapter12AccessRevoked",
  "unsubscribed",
  "source",
  "createdAt",
];

/** All subscribers, paged through server-side in batches, for the admin CSV export. */
async function listAllSubscribers() {
  const store = getSubscriberStore();
  const batchSize = 500;
  let offset = 0;
  const all = [];

  while (true) {
    const { subscribers, total } = await store.listSubscribers({ limit: batchSize, offset });
    all.push(...subscribers);
    offset += batchSize;
    if (offset >= total || subscribers.length === 0) break;
  }

  return all;
}

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscribers = await listAllSubscribers();
  const csv = toCsv(
    subscribers.map((s) => ({ ...s })),
    COLUMNS,
  );

  await getAuditLogStore().record({
    actor: "admin",
    action: "subscribers_csv_exported",
    metadata: { rowCount: subscribers.length },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
