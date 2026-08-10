import { Inngest, EventSchemas } from "inngest";

type AtlasEvents = {
  "atlas/idea-generation.requested": {
    data: { tenantId: string; idempotencyKey: string };
  };
  "atlas/video-prompts.requested": {
    data: { tenantId: string; runId: string; ideaId: string };
  };
  "atlas/video-job.submitted": {
    data: { tenantId: string; runId: string; jobId: string; sceneOrder: number };
  };
  "atlas/audio-job.submitted": {
    data: { tenantId: string; runId: string; jobId: string };
  };
  "atlas/assets.ready": {
    data: { tenantId: string; runId: string };
  };
  "atlas/approval.granted": {
    data: { tenantId: string; runId: string; userId: string };
  };
};

export const inngest = new Inngest({
  id: "atlas-video-factory",
  schemas: new EventSchemas().fromRecord<AtlasEvents>(),
});
