import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { inngest, approvalGranted } from "@/src/workflow/inngest/client";
import { approveRunRequestSchema } from "@/src/schemas/api";

/** Grants Stage 5's human approval gate for a run. Publication never
 *  happens without this call (or tenant policy explicitly opting out) —
 *  see assembleAndPublish in src/workflow/inngest/functions.ts.
 *
 *  Params are typed by hand rather than via Next's generated `RouteContext`
 *  helper so `tsc --noEmit` works standalone, without first requiring
 *  `next build`/`next typegen` to have run. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await ctx.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const parsed = approveRunRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  await inngest.send(
    approvalGranted.create({
      tenantId: parsed.data.tenantId,
      runId,
      userId: parsed.data.userId,
    }),
  );

  return NextResponse.json({ accepted: true });
}
