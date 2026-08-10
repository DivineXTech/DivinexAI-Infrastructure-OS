/**
 * The canonical Atlas AI Video Factory graph.
 *
 * This is a direct encoding of the five-stage diagram: Idea Generation ->
 * Video Prompts -> Generate Video -> Create Audio -> Assemble & Publish.
 * It is the single source of truth consumed by:
 *   - the Inngest functions in src/workflow/inngest/functions.ts
 *   - the React Flow designer in components/workflow/graph-designer.tsx
 *
 * Do not hand-edit the topology in either consumer; change it here instead.
 */

import {
  DEFAULT_POLL_POLICY,
  DEFAULT_RETRY_POLICY,
  type WorkflowGraph,
} from "@/src/types/graph";

export const atlasVideoFactoryGraph: WorkflowGraph = {
  id: "atlas-video-factory",
  version: "1.0.0",
  nodes: [
    // --- Stage 1: Idea Generation ---
    {
      id: "schedule_trigger",
      stageId: "idea_generation",
      kind: "trigger",
      label: "Schedule Trigger",
    },
    {
      id: "atlas_ideas_agent",
      stageId: "idea_generation",
      kind: "ai_agent",
      label: "Atlas Ideas Agent",
      outputSchema: "ideaListSchema",
      retry: DEFAULT_RETRY_POLICY,
    },
    {
      id: "save_ideas",
      stageId: "idea_generation",
      kind: "storage",
      label: "Save Ideas",
    },

    // --- Stage 2: Video Prompts ---
    {
      id: "read_ideas",
      stageId: "video_prompts",
      kind: "storage",
      label: "Read Ideas",
    },
    {
      id: "prompt_director_agent",
      stageId: "video_prompts",
      kind: "ai_agent",
      label: "Prompt Director Agent",
      outputSchema: "scriptScenePlanSchema",
      retry: DEFAULT_RETRY_POLICY,
    },

    // --- Stage 3: Generate Video ---
    {
      id: "submit_video_job",
      stageId: "generate_video",
      kind: "webhook",
      label: "Submit Video Job",
    },
    {
      id: "poll_video_job",
      stageId: "generate_video",
      kind: "poll",
      label: "Wait / Poll",
      poll: DEFAULT_POLL_POLICY,
      retry: DEFAULT_RETRY_POLICY,
    },
    {
      id: "retrieve_video",
      stageId: "generate_video",
      kind: "storage",
      label: "Retrieve Video",
    },

    // --- Stage 4: Create Audio ---
    {
      id: "generate_audio",
      stageId: "create_audio",
      kind: "webhook",
      label: "Generate Voiceover + Music",
    },
    {
      id: "poll_audio_job",
      stageId: "create_audio",
      kind: "poll",
      label: "Wait / Poll",
      poll: DEFAULT_POLL_POLICY,
      retry: DEFAULT_RETRY_POLICY,
    },
    {
      id: "retrieve_audio",
      stageId: "create_audio",
      kind: "storage",
      label: "Retrieve Audio",
    },

    // --- Stage 5: Assemble & Publish ---
    {
      id: "merge_assets",
      stageId: "assemble_publish",
      kind: "tool",
      label: "Merge Assets",
    },
    {
      id: "quality_check",
      stageId: "assemble_publish",
      kind: "quality_check",
      label: "Quality Check",
    },
    {
      id: "human_approval",
      stageId: "assemble_publish",
      kind: "human",
      label: "Human Approval",
      requiresApproval: true,
    },
    {
      id: "publish",
      stageId: "assemble_publish",
      kind: "webhook",
      label: "Publish",
      retry: DEFAULT_RETRY_POLICY,
    },
    {
      id: "log_url",
      stageId: "assemble_publish",
      kind: "storage",
      label: "Log URL to Database",
    },
  ],
  edges: [
    // Stage 1
    { from: "schedule_trigger", to: "atlas_ideas_agent" },
    { from: "atlas_ideas_agent", to: "save_ideas" },
    { from: "save_ideas", to: "atlas_ideas_agent", condition: "retry" },

    // Stage 1 -> Stage 2
    { from: "save_ideas", to: "read_ideas" },

    // Stage 2
    { from: "read_ideas", to: "prompt_director_agent" },
    {
      from: "prompt_director_agent",
      to: "prompt_director_agent",
      condition: "retry",
    },

    // Stage 2 -> Stage 3
    { from: "prompt_director_agent", to: "submit_video_job" },

    // Stage 3
    { from: "submit_video_job", to: "poll_video_job" },
    { from: "poll_video_job", to: "retrieve_video" },
    { from: "poll_video_job", to: "poll_video_job", condition: "retry" },

    // Stage 3 -> Stage 4
    { from: "retrieve_video", to: "generate_audio" },

    // Stage 4
    { from: "generate_audio", to: "poll_audio_job" },
    { from: "poll_audio_job", to: "retrieve_audio" },
    { from: "poll_audio_job", to: "poll_audio_job", condition: "retry" },

    // Stage 4 -> Stage 5
    { from: "retrieve_audio", to: "merge_assets" },

    // Stage 5
    { from: "merge_assets", to: "quality_check" },
    { from: "quality_check", to: "human_approval", condition: "pass" },
    { from: "quality_check", to: "merge_assets", condition: "fail" },
    { from: "human_approval", to: "publish" },
    { from: "publish", to: "log_url" },
  ],
};
