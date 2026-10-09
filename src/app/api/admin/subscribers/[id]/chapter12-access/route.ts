import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isAdminRequestAuthorized } from "@/lib/admin/guard";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { getAuditLogStore } from "@/lib/store/audit-log-store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ revoked: z.boolean() });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const store = getSubscriberStore();
  const subscriber = await store.findById(id);
  if (!subscriber) {
    return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
  }

  await store.setChapter12AccessRevoked(id, parsed.data.revoked);
  await getAuditLogStore().record({
    actor: "admin",
    action: parsed.data.revoked ? "chapter12_access_revoked" : "chapter12_access_restored",
    target: id,
  });

  return NextResponse.json({ success: true });
}
