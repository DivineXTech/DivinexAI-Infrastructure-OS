import "server-only";
import { createSupabaseServiceClient } from "@/src/lib/supabase/server";
import type { ScriptScenePlan } from "@/src/schemas/script";
import type { AudioJob } from "@/src/schemas/audio-job";
import type { VideoJob } from "@/src/schemas/video-job";

/**
 * Shared persistence queries for the Inngest workflow functions
 * (src/workflow/inngest/functions.ts). Kept separate from the functions
 * themselves so each function body reads as pipeline logic, not SQL.
 */

export interface IdeaRow {
  id: string;
  title: string;
  hook: string;
  target_audience: string;
  angle: string;
  tags: string[];
}

export interface SceneRow {
  id: string;
  run_id: string;
  scene_order: number;
  duration_seconds: number;
  visual_prompt: string;
  voiceover_line: string;
  caption_text: string | null;
}

export async function insertIdeas(input: {
  runId: string;
  tenantId: string;
  ideas: readonly {
    title: string;
    hook: string;
    targetAudience: string;
    angle: string;
    tags: readonly string[];
  }[];
}): Promise<IdeaRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("ideas")
    .insert(
      input.ideas.map((idea) => ({
        run_id: input.runId,
        tenant_id: input.tenantId,
        title: idea.title,
        hook: idea.hook,
        target_audience: idea.targetAudience,
        angle: idea.angle,
        tags: idea.tags,
      })),
    )
    .select();

  if (error) throw new Error(`Failed to save ideas: ${error.message}`);
  return data as IdeaRow[];
}

/** Deterministically selects the first-generated idea for the run (Claude
 *  and the mock generator both return their best idea first) and marks it
 *  selected on both the idea and the run. */
export async function selectFirstIdea(runId: string): Promise<IdeaRow> {
  const supabase = createSupabaseServiceClient();

  const { data: idea, error: readError } = await supabase
    .from("ideas")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (readError || !idea) {
    throw new Error(`No ideas found for run ${runId}: ${readError?.message ?? "none saved"}`);
  }

  const { error: updateIdeaError } = await supabase
    .from("ideas")
    .update({ selected: true })
    .eq("id", idea.id);
  if (updateIdeaError) {
    throw new Error(`Failed to mark idea selected: ${updateIdeaError.message}`);
  }

  const { error: updateRunError } = await supabase
    .from("runs")
    .update({ selected_idea_id: idea.id })
    .eq("id", runId);
  if (updateRunError) {
    throw new Error(`Failed to record selected idea on run: ${updateRunError.message}`);
  }

  return idea as IdeaRow;
}

export async function getIdea(ideaId: string): Promise<IdeaRow> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("ideas").select("*").eq("id", ideaId).single();
  if (error || !data) throw new Error(`Failed to read idea ${ideaId}: ${error?.message}`);
  return data as IdeaRow;
}

export async function insertScriptAndScenes(input: {
  runId: string;
  ideaId: string;
  plan: ScriptScenePlan;
}): Promise<SceneRow[]> {
  const supabase = createSupabaseServiceClient();

  const { error: scriptError } = await supabase.from("scripts").upsert(
    {
      run_id: input.runId,
      idea_id: input.ideaId,
      title: input.plan.title,
      total_duration_seconds: input.plan.totalDurationSeconds,
      music_mood: input.plan.musicMood,
      music_direction: input.plan.musicDirection,
    },
    { onConflict: "run_id" },
  );
  if (scriptError) throw new Error(`Failed to save script: ${scriptError.message}`);

  const { data: scenes, error: scenesError } = await supabase
    .from("scenes")
    .upsert(
      input.plan.scenes.map((scene) => ({
        run_id: input.runId,
        idea_id: input.ideaId,
        scene_order: scene.order,
        duration_seconds: scene.durationSeconds,
        visual_prompt: scene.visualPrompt,
        voiceover_line: scene.voiceoverLine,
        caption_text: scene.captionText,
        voice_direction: scene.voiceDirection,
        music_direction: scene.musicDirection,
      })),
      { onConflict: "run_id,scene_order" },
    )
    .select();

  if (scenesError) throw new Error(`Failed to save scenes: ${scenesError.message}`);
  return scenes as SceneRow[];
}

export async function getScenesForRun(runId: string): Promise<SceneRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("scenes")
    .select("*")
    .eq("run_id", runId)
    .order("scene_order", { ascending: true });
  if (error) throw new Error(`Failed to read scenes for run ${runId}: ${error.message}`);
  return data as SceneRow[];
}

export async function upsertArtifact(input: {
  runId: string;
  sceneId?: string;
  kind: "scene_video" | "narration" | "music" | "captions" | "final_video";
  storagePath: string;
  url?: string;
  simulated: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("artifacts").upsert(
    {
      run_id: input.runId,
      scene_id: input.sceneId ?? null,
      kind: input.kind,
      storage_path: input.storagePath,
      url: input.url ?? null,
      simulated: input.simulated,
      metadata: input.metadata ?? {},
    },
    // Matches one of the two partial unique indexes in
    // supabase/migrations/0002_phase2.sql depending on whether this
    // artifact is scene-scoped or run-level.
    { onConflict: input.sceneId ? "run_id,scene_id,kind" : "run_id,kind" },
  );
  if (error) throw new Error(`Failed to save ${input.kind} artifact: ${error.message}`);
}

export async function insertProviderJob(input: {
  runId: string;
  sceneId?: string;
  capability: "video" | "voice" | "music" | "publishing";
  providerName: string;
  externalJobId: string;
  status: VideoJob["status"] | AudioJob["status"];
  simulated: boolean;
  costUsd: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("provider_jobs").upsert(
    {
      run_id: input.runId,
      scene_id: input.sceneId ?? null,
      capability: input.capability,
      provider_name: input.providerName,
      external_job_id: input.externalJobId,
      status: input.status,
      simulated: input.simulated,
      cost_usd: input.costUsd,
      metadata: input.metadata ?? {},
    },
    { onConflict: "capability,provider_name,external_job_id" },
  );
  if (error) throw new Error(`Failed to record ${input.capability} provider job: ${error.message}`);
}

/** Escalates runs.simulation_mode to true; never un-sets it once a run has
 *  touched any simulated capability. Also adds to the run's running cost
 *  total in the same statement to keep it a single round trip. */
export async function markSimulatedAndAddCost(input: {
  runId: string;
  simulated: boolean;
  costUsd: number;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: run, error: readError } = await supabase
    .from("runs")
    .select("simulation_mode, total_cost_usd")
    .eq("id", input.runId)
    .single();
  if (readError || !run) {
    throw new Error(`Failed to read run ${input.runId}: ${readError?.message}`);
  }

  const { error } = await supabase
    .from("runs")
    .update({
      simulation_mode: run.simulation_mode || input.simulated,
      total_cost_usd: Number(run.total_cost_usd) + input.costUsd,
    })
    .eq("id", input.runId);
  if (error) throw new Error(`Failed to update run ${input.runId}: ${error.message}`);
}

export interface AssetCompletionCounts {
  totalScenes: number;
  videoCount: number;
  narrationCount: number;
  musicCount: number;
}

export async function getAssetCompletionCounts(runId: string): Promise<AssetCompletionCounts> {
  const supabase = createSupabaseServiceClient();

  const [{ count: totalScenes }, { data: artifacts, error }] = await Promise.all([
    supabase.from("scenes").select("id", { count: "exact", head: true }).eq("run_id", runId),
    supabase.from("artifacts").select("kind, scene_id").eq("run_id", runId),
  ]);

  if (error) throw new Error(`Failed to read artifacts for run ${runId}: ${error.message}`);

  const videoSceneIds = new Set(
    artifacts!.filter((a) => a.kind === "scene_video").map((a) => a.scene_id),
  );
  const narrationSceneIds = new Set(
    artifacts!.filter((a) => a.kind === "narration").map((a) => a.scene_id),
  );
  const musicCount = artifacts!.filter((a) => a.kind === "music").length;

  return {
    totalScenes: totalScenes ?? 0,
    videoCount: videoSceneIds.size,
    narrationCount: narrationSceneIds.size,
    musicCount,
  };
}

export function isAssemblyReady(counts: AssetCompletionCounts): boolean {
  return (
    counts.totalScenes > 0 &&
    counts.videoCount >= counts.totalScenes &&
    counts.narrationCount >= counts.totalScenes &&
    counts.musicCount >= 1
  );
}

/** Atomically claims a pending run for assembly so a video-completion event
 *  and an audio-completion event racing to trigger assembly at the same
 *  moment can't both start it. Returns false if the run was already
 *  claimed (or isn't in a claimable state). */
export async function claimRunForAssembly(runId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("runs")
    .update({ status: "running" })
    .eq("id", runId)
    .eq("status", "pending")
    .select("id");

  if (error) throw new Error(`Failed to claim run ${runId} for assembly: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export interface AssemblyData {
  run: { id: string; tenant_id: string; simulation_mode: boolean };
  script: { title: string; music_mood: string } | null;
  scenes: Array<{
    order: number;
    durationSeconds: number;
    captionText: string;
    videoUrl?: string;
    narrationUrl?: string;
    simulated: boolean;
  }>;
  musicUrl?: string;
  musicSimulated: boolean;
}

export async function getAssemblyData(runId: string): Promise<AssemblyData> {
  const supabase = createSupabaseServiceClient();

  const [{ data: run, error: runError }, { data: script }, { data: scenes, error: scenesError }, { data: artifacts, error: artifactsError }] =
    await Promise.all([
      supabase.from("runs").select("id, tenant_id, simulation_mode").eq("id", runId).single(),
      supabase.from("scripts").select("title, music_mood").eq("run_id", runId).maybeSingle(),
      supabase
        .from("scenes")
        .select("id, scene_order, duration_seconds, caption_text")
        .eq("run_id", runId)
        .order("scene_order", { ascending: true }),
      supabase.from("artifacts").select("kind, scene_id, url, simulated").eq("run_id", runId),
    ]);

  if (runError || !run) throw new Error(`Failed to read run ${runId}: ${runError?.message}`);
  if (scenesError) throw new Error(`Failed to read scenes: ${scenesError.message}`);
  if (artifactsError) throw new Error(`Failed to read artifacts: ${artifactsError.message}`);

  const byScene = new Map(scenes!.map((scene) => [scene.id, scene]));
  const videoByScene = new Map(
    artifacts!.filter((a) => a.kind === "scene_video").map((a) => [a.scene_id, a]),
  );
  const narrationByScene = new Map(
    artifacts!.filter((a) => a.kind === "narration").map((a) => [a.scene_id, a]),
  );
  const musicArtifact = artifacts!.find((a) => a.kind === "music");

  return {
    run,
    script: script ?? null,
    scenes: [...byScene.values()].map((scene) => {
      const video = videoByScene.get(scene.id);
      const narration = narrationByScene.get(scene.id);
      return {
        order: scene.scene_order,
        durationSeconds: Number(scene.duration_seconds),
        captionText: scene.caption_text ?? "",
        videoUrl: video?.url ?? undefined,
        narrationUrl: narration?.url ?? undefined,
        simulated: Boolean(video?.simulated || narration?.simulated),
      };
    }),
    musicUrl: musicArtifact?.url ?? undefined,
    musicSimulated: Boolean(musicArtifact?.simulated),
  };
}

export async function finalizeRun(input: {
  runId: string;
  tenantId: string;
  ideaId?: string;
  publicUrl: string;
  costUsd: number;
  simulated: boolean;
  publishingProviderJobRowId?: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { error: videoError } = await supabase.from("videos").upsert(
    {
      run_id: input.runId,
      tenant_id: input.tenantId,
      idea_id: input.ideaId ?? null,
      public_url: input.publicUrl,
      published_at: new Date().toISOString(),
      cost_usd: input.costUsd,
      simulated: input.simulated,
    },
    { onConflict: "run_id" },
  );
  if (videoError) throw new Error(`Failed to save published video: ${videoError.message}`);

  const { error: runError } = await supabase
    .from("runs")
    .update({ status: "succeeded" })
    .eq("id", input.runId);
  if (runError) throw new Error(`Failed to finalize run ${input.runId}: ${runError.message}`);
}

export async function getTenantPolicy(
  tenantId: string,
): Promise<{ requireApprovalBeforePublish: boolean }> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("tenants")
    .select("require_approval_before_publish")
    .eq("id", tenantId)
    .maybeSingle();

  // Fail closed: an unknown/unseeded tenant still requires human approval.
  return { requireApprovalBeforePublish: data?.require_approval_before_publish ?? true };
}
