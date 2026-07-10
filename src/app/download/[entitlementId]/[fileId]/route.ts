import { NextResponse, type NextRequest } from "next/server";
import { requireUser, AuthError } from "@/modules/auth/session";
import { getSignedDownloadUrl, FileAccessError } from "@/modules/files/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ entitlementId: string; fileId: string }> }) {
  const { entitlementId, fileId } = await params;

  try {
    const user = await requireUser();
    const signedUrl = await getSignedDownloadUrl({
      buyerId: user.id,
      entitlementId,
      productFileId: fileId,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.redirect(signedUrl);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (err instanceof FileAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 403 });
    }
    return NextResponse.json({ error: "Could not process this download." }, { status: 500 });
  }
}
