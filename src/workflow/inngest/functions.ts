import { NonRetriableError } from "inngest";
import {
  inngest,
  ideaGenerationRequested,
  videoPromptsRequested,
  videoJobSubmitted,
  videoJobWebhook,
  audioRequested,
  musicJobWebhook,
  assetsReady,
  approvalGranted,
} from "@/src/workflow/inngest/client";
import { supabaseWorkflowEngine } from "@/src/workflow/engine";
import { atlasVideoFactoryGraph } from "@/src/graph/atlas-video-factory.graph";
import { getNode } from "@/src/types/graph";
import { deriveIdempotencyKey } from "@/src/lib/idempotency";
import { generateIdeaList, generateScript } from "@/src/providers/ai";
import {
  videoProvider,
  voiceProvider,
  musicProvider,
  publishingProvider,
} from "@/src/providers/registry";
import { composeVideo } from "@/src/composition/render";
import {
  claimRunForAssembly,
  finalizeRun,
  getAssemblyData,
  getAssetCompletionCounts,
  getIdea,
  getScenesForRun,
  getTenantPolicy,
  insertIdeas,
  insertProviderJob,
  insertScriptAndScenes,
  isAssemblyReady,
  markSimulatedAndAddCost,
  selectFirstIdea,
  upsertArtifact,
} from "@/src/workflow/db";

const MAX_QUALITY_CHECK_RETRIES = 3;
const VIDEO_WEBHOOK_WAIT = "10m";
const AUDIO_WEBHOOK_WAIT = "5m";

/**
 * Stage 1 — Idea Generation.
 * Schedule trigger -> Atlas Ideas Agent (Claude, or a deterministic mock
 * when ANTHROPIC_API_KEY is unset) -> Structured Output -> Save Ideas ->
 * select the top idea. Retries on schema-validation failure.
 */
export const generateIdeas = inngest.createFunction(
  { id: "atlas-generate-ideas", retries: 4, triggers: ideaGenerationRequested },
  async ({ event, step }) => {
    const { tenantId, idempotencyKey } = event.data;

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

    const generated = await step.run("atlas-ideas-agent", () =>
      generateIdeaList({ tenantId }),
    );

    await step.run("save-ideas", async () => {
      await insertIdeas({ runId: run.id, tenantId, ideas: generated.data.ideas });
      await markSimulatedAndAddCost({ runId: run.id, simulated: generated.simulated, costUsd: 0 });
    });

    const selectedIdea = await step.run("select-idea", () => selectFirstIdea(run.id));

    await supabaseWorkflowEngine.appendAuditLog({
      runId: run.id,
      actor: "system",
      action: "idea.selected",
      metadata: { ideaId: selectedIdea.id, title: selectedIdea.title, simulated: generated.simulated },
    });

    await step.sendEvent(
      "request-video-prompts",
      videoPromptsRequested.create({ tenantId, runId: run.id, ideaId: selectedIdea.id }),
    );

    return { runId: run.id, ideaId: selectedIdea.id, ideaCount: generated.data.ideas.length };
  },
);

/**
 * Stage 2 — Video Prompts.
 * Read Ideas -> Prompt Director Agent -> Script + Scene Plan (captions,
 * visual prompts, voice direction, music direction), retrying the agent
 * call on schema-validation failure, then fans out Stage 3 (one event per
 * scene) and Stage 4 (one event for the whole run's narration + music).
 */
export const generateVideoPrompts = inngest.createFunction(
  { id: "atlas-generate-video-prompts", retries: 4, triggers: videoPromptsRequested },
  async ({ event, step }) => {
    const { tenantId, runId, ideaId } = event.data;

    const idea = await step.run("read-idea", () => getIdea(ideaId));

    const generated = await step.run("prompt-director-agent", () =>
      generateScript({ ideaId, title: idea.title, hook: idea.hook, angle: idea.angle }),
    );

    const scenes = await step.run("save-script-and-scenes", async () => {
      const savedScenes = await insertScriptAndScenes({ runId, ideaId, plan: generated.data });
      await markSimulatedAndAddCost({ runId, simulated: generated.simulated, costUsd: 0 });
      return savedScenes;
    });

    await supabaseWorkflowEngine.appendAuditLog({
      runId,
      actor: "system",
      action: "script.generated",
      metadata: { sceneCount: scenes.length, simulated: generated.simulated },
    });

    for (const scene of scenes) {
      await step.sendEvent(
        `submit-scene-video-${scene.scene_order}`,
        videoJobSubmitted.create({
          tenantId,
          runId,
          sceneId: scene.id,
          sceneOrder: scene.scene_order,
          visualPrompt: scene.visual_prompt,
          durationSeconds: scene.duration_seconds,
        }),
      );
    }

    await step.sendEvent("request-audio", audioRequested.create({ tenantId, runId }));

    return { runId, sceneCount: scenes.length };
  },
);

/**
 * Stage 3 — Generate Video (one run per scene).
 * Submit Video Job -> (webhook, bounded-timeout) or (bounded poll fallback)
 * -> Retrieve Video -> persist artifact -> check whether every scene's
 * video and narration plus the run's music are now ready, and if so kick
 * off Stage 5.
 */
export const generateVideo = inngest.createFunction(
  { id: "atlas-generate-video", retries: 4, triggers: videoJobSubmitted },
  async ({ event, step }) => {
    const { tenantId, runId, sceneId, sceneOrder, visualPrompt, durationSeconds } = event.data;
    const node = getNode(atlasVideoFactoryGraph, "poll_video_job");
    const poll = node.poll!;

    const { jobId } = await step.run("submit-video-job", () =>
      videoProvider.submitJob({ runId, sceneOrder, visualPrompt, durationSeconds }),
    );

    // Mock providers never call our webhook endpoint — waiting on one would
    // just burn the full timeout for no reason, so only real vendors wait
    // for a webhook before falling back to polling.
    const webhookResult = videoProvider.simulated
      ? null
      : await step.waitForEvent(`wait-video-webhook-${jobId}`, {
          event: videoJobWebhook,
          if: `async.data.jobId == "${jobId}"`,
          timeout: VIDEO_WEBHOOK_WAIT,
        });

    let finalStatus = webhookResult?.data;

    if (!finalStatus) {
      // No webhook arrived in time — fall back to bounded polling.
      const deadline = Date.now() + poll.timeoutMs;
      while (Date.now() < deadline) {
        const polled = await step.run(`poll-video-job-${jobId}`, () =>
          videoProvider.getJobStatus(jobId),
        );
        if (polled.status === "completed" || polled.status === "failed") {
          finalStatus = polled;
          break;
        }
        await step.sleep(`wait-video-job-${jobId}`, poll.intervalMs);
      }
    }

    if (!finalStatus || finalStatus.status !== "completed" || !finalStatus.assetUrl) {
      throw new NonRetriableError(
        `Video job ${jobId} for run ${runId} scene ${sceneOrder} did not complete: ` +
          (finalStatus?.error ?? "timed out"),
      );
    }

    const simulated = "simulated" in finalStatus ? Boolean(finalStatus.simulated) : videoProvider.simulated;
    const costUsd = "costUsd" in finalStatus ? Number(finalStatus.costUsd ?? 0) : 0;

    await step.run("persist-video-artifact", async () => {
      await upsertArtifact({
        runId,
        sceneId,
        kind: "scene_video",
        storagePath: finalStatus!.assetUrl!,
        url: finalStatus!.assetUrl,
        simulated,
        metadata: { jobId, sceneOrder },
      });
      await insertProviderJob({
        runId,
        sceneId,
        capability: "video",
        providerName: videoProvider.name,
        externalJobId: jobId,
        status: "completed",
        simulated,
        costUsd,
      });
      await markSimulatedAndAddCost({ runId, simulated, costUsd });
    });

    await maybeStartAssembly(step, tenantId, runId);

    return { jobId, sceneOrder, simulated };
  },
);

/**
 * Stage 4 — Create Audio.
 * Generate Voiceover (ElevenLabs Multilingual v2, per scene) + Music (one
 * job for the whole run), each via webhook-or-bounded-poll, then the same
 * assembly-readiness check as Stage 3.
 */
export const generateAudio = inngest.createFunction(
  { id: "atlas-generate-audio", retries: 4, triggers: audioRequested },
  async ({ event, step }) => {
    const { tenantId, runId } = event.data;
    const poll = getNode(atlasVideoFactoryGraph, "poll_audio_job").poll!;

    const scenes = await step.run("read-scenes", () => getScenesForRun(runId));

    for (const scene of scenes) {
      const { jobId } = await step.run(`submit-narration-${scene.scene_order}`, () =>
        voiceProvider.submitVoiceoverJob({
          runId,
          sceneId: scene.id,
          text: scene.voiceover_line,
        }),
      );

      const status = await pollAudioJob(step, "voice", jobId, poll);

      if (status.status !== "completed" || !status.assetUrl) {
        throw new NonRetriableError(
          `Narration job ${jobId} for run ${runId} scene ${scene.scene_order} did not complete: ` +
            (status.error ?? "timed out"),
        );
      }

      await step.run(`persist-narration-${scene.scene_order}`, async () => {
        await upsertArtifact({
          runId,
          sceneId: scene.id,
          kind: "narration",
          storagePath: status.assetUrl!,
          url: status.assetUrl,
          simulated: status.simulated,
          metadata: { jobId, sceneOrder: scene.scene_order },
        });
        await insertProviderJob({
          runId,
          sceneId: scene.id,
          capability: "voice",
          providerName: voiceProvider.name,
          externalJobId: jobId,
          status: "completed",
          simulated: status.simulated,
          costUsd: status.costUsd,
        });
        await markSimulatedAndAddCost({ runId, simulated: status.simulated, costUsd: status.costUsd });
      });
    }

    const totalDuration = scenes.reduce((sum, scene) => sum + Number(scene.duration_seconds), 0);
    const { jobId: musicJobId } = await step.run("submit-music-job", () =>
      musicProvider.submitMusicJob({
        runId,
        mood: "upbeat-explainer",
        direction: "Light bed matching the script's overall tone",
        durationSeconds: totalDuration,
      }),
    );

    const musicStatus = await pollAudioJob(step, "music", musicJobId, poll);

    if (musicStatus.status !== "completed" || !musicStatus.assetUrl) {
      throw new NonRetriableError(
        `Music job ${musicJobId} for run ${runId} did not complete: ` +
          (musicStatus.error ?? "timed out"),
      );
    }

    await step.run("persist-music-artifact", async () => {
      await upsertArtifact({
        runId,
        kind: "music",
        storagePath: musicStatus.assetUrl!,
        url: musicStatus.assetUrl,
        simulated: musicStatus.simulated,
        metadata: { jobId: musicJobId },
      });
      await insertProviderJob({
        runId,
        capability: "music",
        providerName: musicProvider.name,
        externalJobId: musicJobId,
        status: "completed",
        simulated: musicStatus.simulated,
        costUsd: musicStatus.costUsd,
      });
      await markSimulatedAndAddCost({ runId, simulated: musicStatus.simulated, costUsd: musicStatus.costUsd });
    });

    await maybeStartAssembly(step, tenantId, runId);

    return { runId, sceneCount: scenes.length, musicJobId };
  },
);

/**
 * Stage 5 — Assemble & Publish.
 * Compose (Remotion + ffmpeg, or the mock composer) -> Quality Check
 * -(FAIL)-> re-compose (bounded retries) -(PASS)-> Human Approval (skipped
 * only if tenant policy explicitly opts out) -> Publish -> Log URL, cost,
 * and artifacts to the database.
 */
export const assembleAndPublish = inngest.createFunction(
  { id: "atlas-assemble-and-publish", retries: 2, triggers: assetsReady },
  async ({ event, step }) => {
    const { tenantId, runId } = event.data;

    const claimed = await step.run("claim-run", () => claimRunForAssembly(runId));
    if (!claimed) {
      // Another trigger (video or audio completing last) already started
      // assembly for this run — this is the expected idempotent no-op path
      // when both fan-in branches race to signal readiness.
      return { runId, skipped: true };
    }

    const assembly = await step.run("load-assembly-data", () => getAssemblyData(runId));

    let compositionResult: Awaited<ReturnType<typeof composeVideo>> | null = null;
    let passed = false;
    let attempt = 0;

    while (!passed && attempt < MAX_QUALITY_CHECK_RETRIES) {
      attempt += 1;
      compositionResult = await step.run(`compose-video-${attempt}`, () =>
        composeVideo({
          runId,
          title: assembly.script?.title ?? "Untitled",
          brandName: "Atlas",
          scenes: assembly.scenes.map((scene) => ({
            order: scene.order,
            durationSeconds: scene.durationSeconds,
            videoUrl: scene.videoUrl ?? "",
            narrationUrl: scene.narrationUrl,
            captionText: scene.captionText,
          })),
          musicUrl: assembly.musicUrl,
          simulated:
            assembly.run.simulation_mode ||
            assembly.musicSimulated ||
            assembly.scenes.some((scene) => scene.simulated),
        }),
      );

      passed = await step.run(`quality-check-${attempt}`, () =>
        runQualityCheck(compositionResult!, assembly.scenes.length),
      );
    }

    if (!passed || !compositionResult) {
      throw new NonRetriableError(
        `Quality check failed after ${MAX_QUALITY_CHECK_RETRIES} composition attempts for run ${runId}`,
      );
    }

    await step.run("persist-final-artifact", async () => {
      await upsertArtifact({
        runId,
        kind: "final_video",
        storagePath: compositionResult!.outputPath,
        url: compositionResult!.url,
        simulated: compositionResult!.simulated,
        metadata: { durationSeconds: compositionResult!.durationSeconds, note: compositionResult!.note },
      });
      await markSimulatedAndAddCost({
        runId,
        simulated: compositionResult!.simulated,
        costUsd: compositionResult!.costUsd,
      });
    });

    await supabaseWorkflowEngine.appendAuditLog({
      runId,
      actor: "system",
      action: "quality_check.passed",
      metadata: { attempts: attempt, simulated: compositionResult.simulated },
    });

    const policy = await step.run("load-tenant-policy", () => getTenantPolicy(tenantId));

    if (policy.requireApprovalBeforePublish) {
      const approval = await step.waitForEvent("wait-for-human-approval", {
        event: approvalGranted,
        if: `async.data.runId == "${runId}"`,
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
    } else {
      await supabaseWorkflowEngine.appendAuditLog({
        runId,
        actor: "system",
        action: "approval.skipped_by_policy",
      });
    }

    const published = await step.run("publish", () =>
      publishingProvider.publish({
        videoUrl: compositionResult!.url ?? compositionResult!.outputPath,
        title: assembly.script?.title ?? "Untitled",
        description: `Published by Atlas AI Video Factory for run ${runId}.`,
      }),
    );

    await step.run("log-url-and-cost", async () => {
      await insertProviderJob({
        runId,
        capability: "publishing",
        providerName: publishingProvider.name,
        externalJobId: `publish-${runId}`,
        status: "completed",
        simulated: published.simulated,
        costUsd: published.costUsd,
      });
      await markSimulatedAndAddCost({ runId, simulated: published.simulated, costUsd: published.costUsd });
      await finalizeRun({
        runId,
        tenantId,
        publicUrl: published.publicUrl,
        costUsd: published.costUsd,
        simulated: published.simulated,
      });
    });

    await supabaseWorkflowEngine.appendAuditLog({
      runId,
      actor: "system",
      action: "run.published",
      toStatus: "succeeded",
      metadata: { tenantId, publicUrl: published.publicUrl, simulated: published.simulated },
    });

    return { runId, publicUrl: published.publicUrl, simulated: published.simulated };
  },
);

// --- shared helpers -------------------------------------------------------

// These two helpers are shared across multiple Inngest functions whose
// `step` objects carry function-specific generic types (tied to each
// function's own trigger/middleware). Typing `step` as `any` here — rather
// than fighting Inngest's step-tool generics with a structural interface —
// keeps every call site elsewhere in this file fully typed while still
// giving each helper's own body real types via its explicit return type.
type AnyStep = any;

async function pollAudioJob(
  step: AnyStep,
  kind: "voice" | "music",
  jobId: string,
  poll: { intervalMs: number; timeoutMs: number },
): Promise<{ status: string; assetUrl?: string; costUsd: number; simulated: boolean; error?: string }> {
  const provider = kind === "voice" ? voiceProvider : musicProvider;

  // ElevenLabs narration is synchronous (it's already done by the time
  // submitVoiceoverJob resolves) and mock providers never call our webhook
  // endpoint, so only wait for a webhook when this is a real, genuinely
  // async music vendor.
  const shouldWaitForWebhook = kind === "music" && !provider.simulated;

  const webhookResult = shouldWaitForWebhook
    ? await step.waitForEvent(`wait-audio-webhook-${jobId}`, {
        event: musicJobWebhook,
        if: `async.data.jobId == "${jobId}"`,
        timeout: AUDIO_WEBHOOK_WAIT,
      })
    : null;

  if (webhookResult?.data) {
    return {
      status: webhookResult.data.status,
      assetUrl: webhookResult.data.assetUrl,
      costUsd: webhookResult.data.costUsd ?? 0,
      simulated: provider.simulated,
      error: webhookResult.data.error,
    };
  }

  const deadline = Date.now() + poll.timeoutMs;
  while (Date.now() < deadline) {
    const polled = (await step.run(`poll-${kind}-job-${jobId}`, () =>
      provider.getJobStatus(jobId),
    )) as { status: string; assetUrl?: string; costUsd: number; simulated: boolean; error?: string };
    if (polled.status === "completed" || polled.status === "failed") {
      return {
        status: polled.status,
        assetUrl: polled.assetUrl,
        costUsd: polled.costUsd,
        simulated: polled.simulated,
        error: polled.error,
      };
    }
    await step.sleep(`wait-${kind}-job-${jobId}`, poll.intervalMs);
  }

  return { status: "failed", costUsd: 0, simulated: provider.simulated, error: "timed out" };
}

async function maybeStartAssembly(
  step: AnyStep,
  tenantId: string,
  runId: string,
): Promise<void> {
  const counts = (await step.run(`check-assembly-readiness-${runId}`, () =>
    getAssetCompletionCounts(runId),
  )) as Awaited<ReturnType<typeof getAssetCompletionCounts>>;

  if (isAssemblyReady(counts)) {
    await step.sendEvent(`signal-assets-ready-${runId}`, assetsReady.create({ tenantId, runId }));
  }
}

function runQualityCheck(
  result: { durationSeconds: number; simulated: boolean },
  expectedSceneCount: number,
): boolean {
  // Deterministic automated gate: the composed output must have positive
  // duration and the run must have had at least one scene. A real
  // deployment should extend this with loudness/resolution/frame-drop
  // checks against the rendered file.
  return result.durationSeconds > 0 && expectedSceneCount > 0;
}

export const atlasFunctions = [
  generateIdeas,
  generateVideoPrompts,
  generateVideo,
  generateAudio,
  assembleAndPublish,
];
