import { NextResponse, type NextRequest } from "next/server";
import { isValidReferralCodeFormat, normalizeReferralCode } from "@/lib/referral";
import { siteUrl } from "@/config/site";

export const dynamic = "force-dynamic";

const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function GET(_request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const normalized = normalizeReferralCode(code);

  const destination = new URL("/join", siteUrl);
  if (isValidReferralCodeFormat(normalized)) {
    destination.searchParams.set("ref", normalized);
  }

  const response = NextResponse.redirect(destination, { status: 307 });

  if (isValidReferralCodeFormat(normalized)) {
    response.cookies.set("bb_ref", normalized, {
      maxAge: REFERRAL_COOKIE_MAX_AGE,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  }

  return response;
}
