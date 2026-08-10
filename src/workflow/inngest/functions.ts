import { NonRetriableError } from "inngest";
import { inngest } from "@/src/workflow/inngest/client";
import { supabaseWorkflowEngine } from "@/src/workflow/engine";
import { atlasVideoFactoryGraph } from "@/src/graph/atlas-video-factory.graph";
import { getNode } from "@/src/types/graph";
import { deriveIdempotencyKey } from "@/src/lib/idempotency";
import { generateStructured } from "@/src/providers/claude";
import { ideaListSchema } from "@/src/schemas/idea";
import { scriptScenePlanSchema } from "@/src/schemas/script";
import {
  videoProvider,
  voiceProvider,
  publishingProvider,
} from "@/src/providers/registry";
import { createSupabaseServiceClient } from "@/src/lib/supabase/server";

const MAX_QUALITY_CHECK_RETRIES = 3;

/**
 * Stage 1 — Idea Generation.
 * Schedule trigger -> Atlas Ideas Agent -> Structured Output -> Save Ideas,
 * with retries (Structured Output -> Atlas Ideas Agent) on validation failure.
 */
export const generateIdeas = inngest.createFunction(
  { id: "atlas-generate-ideas", retries: 4 },
  { event: "atlas/idea-generation.requested" },
  async ({ event, step }) => {
    const { tenantId, idempotencyKey } = event.data;
    const node = getNode(atlasVideoFactoryGraph, "atlas_ideas_agent");

    const run = await step.run("start-run", () =>
      supabaseWorkflowEngine.startRun({
        graphId: atlasVideoFactoryGraph.id,
        graphVersion: atlasVideoFactoryGraph.version,
        tenantId,
        idempotencyKey: deriveIdempotencyKey({
          tenantId,
          graphId: atlasVideoFactoryGraph.id,
          naturalKey: idempotencyKey,
        }),
        payload: event.data,
      }),
    );

    const result = await step.run("atlas-ideas-agent", async () => {
      const generated = await generateStructured({
        schema: ideaListSchema,
        schemaName: "ideaListSchema",
        system:
          "You are the Atlas Ideas Agent. Generate short-form video ideas " +
          "tailored to the tenant's content strategy.",
        prompt: `Generate 5 fresh short-form video ideas for tenant ${tenantId}.`,
      });

      if (!generated.valid) {
        // Schema validation failed — this throws so Inngest retries the
        // step (backoff configured at the function level), mirroring the
        // "Structured Output -> Atlas Ideas Agent" retry edge in the graph.
        throw new Error(
          `Idea generation failed schema validation: ${generated.issues?.join("; ")}`,
        );
      }
      return generated.data;
    });

    await step.run("save-ideas", async () => {
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase.from("ideas").insert(
        result!.ideas.map((idea) => ({
          run_id: run.id,
          tenant_id: tenantId,
          title: idea.title,
          hook: idea.hook,
          target_audience: idea.targetAudience,
          angle: idea.angle,
          tags: idea.tags,
        })),
      );
      if (error) throw new Error(`Failed to save ideas: ${error.message}`);

      await supabaseWorkflowEngine.recordStep({
        id: `${run.id}:${node.id}`,
        runId: run.id,
        nodeId: node.id,
        stageId: node.stageId,
        kind: node.kind,
        status: "succeeded",
        attempt: 1,
        idempotencyKey: run.idempotencyKey,
      });
    });

    return { runId: run.id, ideaCount: result!.ideas.length };
  },
);

/**
 * Stage 2 — Video Prompts.
 * Read Ideas -> Prompt Director Agent -> Script + Scene Plan, retrying the
 * agent call on schema-validation failure.
 */
export const generateVideoPrompts = inngest.createFunction(
  { id: "atlas-generate-video-prompts", retries: 4 },
  { event: "atlas/video-prompts.requested" },
  async ({ event, step }) => {
    const { tenantId, runId, ideaId } = event.data;
    const supabase = createSupabaseServiceClient();

    const idea = await step.run("read-idea", async () => {
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .eq("id", ideaId)
        .single();
      if (error) throw new Error(`Failed to read idea: ${error.message}`);
      return data;
    });

    const plan = await step.run("prompt-director-agent", async () => {
      const generated = await generateStructured({
        schema: scriptScenePlanSchema,
        schemaName: "scriptScenePlanSchema",
        system:
          "You are the Prompt Director Agent. Turn a video idea into a " +
          "scene-by-scene shot list with voiceover lines and visual prompts.",
        prompt: `Idea: ${idea.title}\nHook: ${idea.hook}\nAngle: ${idea.angle}`,
      });

      if (!generated.valid) {
        throw new Error(
          `Scene plan failed schema validation: ${generated.issues?.join("; ")}`,
        );
      }
      return generated.data!;
    });

    for (const scene of plan.scenes) {
      await step.sendEvent(`submit-scene-${scene.order}`, {
        name: "atlas/video-job.submitted",
        data: { tenantId, runId, jobId: "", sceneOrder: scene.order },
      });
    }

    return { runId, sceneCount: plan.scenes.length };
  },
);

/**
 * Stage 3 — Generate Video.
 * Submit Video Job -> Wait/Poll (bounded, retry-safe) -> Retrieve Video.
 */
export const generateVideo = inngest.createFunction(
  { id: "atlas-generate-video", retries: 4 },
  { event: "atlas/video-job.submitted" },
  async ({ event, step }) => {
    const { runId, sceneOrder } = event.data;
    const node = getNode(atlasVideoFactoryGraph, "poll_video_job");
    const poll = node.poll!;

    const { jobId } = await step.run("submit-video-job", () =>
      videoProvider.submitJob({
        scene: { order: sceneOrder } as never,
        ideaId: runId,
      }),
    );

    const deadline = Date.now() + poll.timeoutMs;
    let status: Awaited<ReturnType<typeof videoProvider.getJobStatus>> | null =
      null;

    while (Date.now() < deadline) {
      status = await step.run(`poll-video-job-${jobId}`, () =>
        videoProvider.getJobStatus(jobId),
      );
      if (status.status === "completed" || status.status === "failed") break;
      await step.sleep(`wait-video-job-${jobId}`, poll.intervalMs);
    }

    if (!status || status.status !== "completed") {
      throw new NonRetriableError(
        `Video job ${jobId} did not complete within ${poll.timeoutMs}ms`,
      );
    }

    return { jobId, assetUrl: status.assetUrl };
  },
);

/**
 * Stage 4 — Create Audio.
 * Generate Voiceover + Music -> Wait/Poll (bounded, retry-safe) -> Retrieve Audio.
 */
export const generateAudio = inngest.createFunction(
  { id: "atlas-generate-audio", retries: 4 },
  { event: "atlas/audio-job.submitted" },
  async ({ event, step }) => {
    const node = getNode(atlasVideoFactoryGraph, "poll_audio_job");
    const poll = node.poll!;

    const { jobId } = await step.run("submit-audio-job", () =>
      voiceProvider.submitVoiceoverJob({ text: "" }),
    );

    const deadline = Date.now() + poll.timeoutMs;
    let status: Awaited<ReturnType<typeof voiceProvider.getJobStatus>> | null =
      null;

    while (Date.now() < deadline) {
      status = await step.run(`poll-audio-job-${jobId}`, () =>
        voiceProvider.getJobStatus(jobId),
      );
      if (status.status === "completed" || status.status === "failed") break;
      await step.sleep(`wait-audio-job-${jobId}`, poll.intervalMs);
    }

    if (!status || status.status !== "completed") {
      throw new NonRetriableError(
        `Audio job ${jobId} did not complete within ${poll.timeoutMs}ms`,
      );
    }

    return { jobId, assetUrl: status.assetUrl };
  },
);

/**
 * Stage 5 — Assemble & Publish.
 * Merge Assets -> Quality Check -(FAIL)-> Merge Assets (bounded retries)
 *              -(PASS)-> Human Approval -> Publish -> Log URL to Database.
 * Publish never fires without an explicit approval event unless tenant
 * policy opts out (see TenantPolicy in src/types/contract.ts).
 */
export const assembleAndPublish = inngest.createFunction(
  { id: "atlas-assemble-and-publish", retries: 2 },
  { event: "atlas/assets.ready" },
  async ({ event, step }) => {
    const { tenantId, runId } = event.data;

    let passed = false;
    let attempt = 0;

    while (!passed && attempt < MAX_QUALITY_CHECK_RETRIES) {
      attempt += 1;
      await step.run(`merge-assets-${attempt}`, async () => {
        // Deterministic asset merge (Remotion/FFmpeg composition) goes here.
        return { merged: true };
      });

      passed = await step.run(`quality-check-${attempt}`, async () => {
        // Automated pass/fail gate (loudness, resolution, duration checks).
        return true;
      });
    }

    if (!passed) {
      throw new NonRetriableError(
        `Quality check failed after ${MAX_QUALITY_CHECK_RETRIES} merge attempts for run ${runId}`,
      );
    }

    await supabaseWorkflowEngine.appendAuditLog({
      runId,
      actor: "system",
      action: "quality_check.passed",
    });

    const approval = await step.waitForEvent("wait-for-human-approval", {
      event: "atlas/approval.granted",
      match: "data.runId",
      timeout: "7d",
    });

    if (!approval) {
      throw new NonRetriableError(
        `Run ${runId} was not approved for publish within 7 days`,
      );
    }

    await supabaseWorkflowEngine.appendAuditLog({
      runId,
      actor: { userId: approval.data.userId },
      action: "approval.granted",
    });

    const published = await step.run("publish", () =>
      publishingProvider.publish({
        videoUrl: "",
        title: "",
        description: "",
      }),
    );

    await step.run("log-url", async () => {
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase
        .from("videos")
        .update({ public_url: published.publicUrl, published_at: new Date().toISOString() })
        .eq("run_id", runId);
      if (error) throw new Error(`Failed to log published URL: ${error.message}`);
    });

    await supabaseWorkflowEngine.appendAuditLog({
      runId,
      actor: "system",
      action: "run.published",
      toStatus: "succeeded",
      metadata: { tenantId, publicUrl: published.publicUrl },
    });

    return { runId, publicUrl: published.publicUrl };
  },
);

export const atlasFunctions = [
  generateIdeas,
  generateVideoPrompts,
  generateVideo,
  generateAudio,
  assembleAndPublish,
];
