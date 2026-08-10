import { Inngest, eventType, staticSchema } from "inngest";

/**
 * Typed event definitions for the Atlas pipeline (Inngest v4's
 * `eventType()` + `staticSchema()` replace the old client-level
 * `EventSchemas` registry — each event now carries its own type-only
 * schema and is passed directly as a function's trigger). No runtime
 * validation happens here; inbound webhook payloads are already validated
 * against src/schemas/webhook.ts before an event is sent.
 */
export const ideaGenerationRequested = eventType("atlas/idea-generation.requested", {
  schema: staticSchema<{ tenantId: string; idempotencyKey: string }>(),
});

export const videoPromptsRequested = eventType("atlas/video-prompts.requested", {
  schema: staticSchema<{ tenantId: string; runId: string; ideaId: string }>(),
});

export const videoJobSubmitted = eventType("atlas/video-job.submitted", {
  schema: staticSchema<{
    tenantId: string;
    runId: string;
    sceneId: string;
    sceneOrder: number;
    visualPrompt: string;
    durationSeconds: number;
  }>(),
});

export const videoJobWebhook = eventType("atlas/video-job.webhook", {
  schema: staticSchema<{
    jobId: string;
    status: "queued" | "processing" | "completed" | "failed";
    assetUrl?: string;
    costUsd?: number;
    error?: string;
  }>(),
});

export const audioRequested = eventType("atlas/audio.requested", {
  schema: staticSchema<{ tenantId: string; runId: string }>(),
});

export const musicJobWebhook = eventType("atlas/music-job.webhook", {
  schema: staticSchema<{
    jobId: string;
    status: "queued" | "processing" | "completed" | "failed";
    assetUrl?: string;
    costUsd?: number;
    error?: string;
  }>(),
});

export const assetsReady = eventType("atlas/assets.ready", {
  schema: staticSchema<{ tenantId: string; runId: string }>(),
});

export const approvalGranted = eventType("atlas/approval.granted", {
  schema: staticSchema<{ tenantId: string; runId: string; userId: string }>(),
});

export const inngest = new Inngest({ id: "atlas-video-factory" });
