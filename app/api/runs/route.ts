import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { inngest, ideaGenerationRequested } from "@/src/workflow/inngest/client";
import { startRunRequestSchema } from "@/src/schemas/api";

/** Manual trigger for Stage 1 (Idea Generation) — the "manual trigger"
 *  alternative to the schedule trigger in the pipeline diagram. */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
  }

  const parsed = startRunRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const idempotencyKey = parsed.data.idempotencyKey ?? randomUUID();

  await inngest.send(
    ideaGenerationRequested.create({
      tenantId: parsed.data.tenantId,
      idempotencyKey,
    }),
  );

  return NextResponse.json({ accepted: true, idempotencyKey }, { status: 202 });
}
