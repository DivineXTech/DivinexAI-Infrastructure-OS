import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeRequestSchema } from "@/lib/validation/schemas";
import { getSubscriberStore } from "@/lib/store/subscriber-store";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp, hashIp } from "@/lib/security/request-ip";

export const dynamic = "force-dynamic";

const GENERIC_MESSAGE = "If that email was on our waitlist, it has been unsubscribed.";

export async function POST(request: NextRequest) {
  const ipKey = hashIp(getClientIp(request));
  const rateLimit = checkRateLimit(`unsubscribe:${ipKey}`, 8, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = unsubscribeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const store = getSubscriberStore();
  await store.markUnsubscribedByEmail(parsed.data.email);

  return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
}
