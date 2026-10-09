import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/auth";
import { getAuditLogStore } from "@/lib/store/audit-log-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  await getAuditLogStore().record({ actor: "admin", action: "admin_logout" });
  // A plain HTML <form method="post"> (the admin nav's logout button, no
  // JS required) expects a redirect response, not a JSON body to render.
  const response = NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
