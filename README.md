# Atlas AI Video Factory

Production blueprint for a governed AI-video automation system: from idea to
published video — fully automated, governed, and observable.

Part of the [DivinexAI Infrastructure OS](#about-divinexai-infrastructure-os)
ecosystem.

## Pipeline

1. **Idea Generation** — generate and validate video ideas on a schedule.
2. **Video Prompts** — turn an idea into a script and scene plan.
3. **Generate Video** — submit and retrieve video-generation jobs.
4. **Create Audio** — generate and retrieve voiceover and music.
5. **Assemble & Publish** — merge assets, run an automated quality check,
   require human approval, publish, and persist the public URL.

See `src/graph/atlas-video-factory.graph.ts` for the exact node/edge
topology and `components/workflow/graph-designer.tsx` for a live React Flow
rendering of it at `/`.

## Stack

- Next.js 16, React 19, TypeScript strict, Tailwind, shadcn/ui
- React Flow for the visual workflow designer
- Supabase — Postgres, Auth, Storage, Realtime, and RLS
- Inngest for durable execution
- Anthropic Claude for idea generation, scripts, and scene plans
- ElevenLabs (Multilingual v2) for narration
- Remotion + FFmpeg for composition
- Pluggable, vendor-neutral video, music, storage, and publishing providers
  behind a generic HTTP contract (`src/providers/http/client.ts`)

## Getting started

```bash
cp .env.example .env.local   # every credential is optional — see Simulation Mode below
npm install
npm run dev                  # app at http://localhost:3000
```

Apply the database schema in `supabase/migrations/0001_init.sql` and
`0002_phase2.sql` (in order) to your Supabase project before running the
pipeline.

Visit `/providers` (or `GET /api/providers/status`) for live status of every
capability — Anthropic, ElevenLabs, video/music/publishing vendors,
Supabase Storage, and the Remotion/ffmpeg composition pipeline — without
ever exposing a secret value.

### Simulation Mode

Every provider credential is optional. Any capability left unconfigured
runs against a deterministic mock instead of failing, and is always
labeled — in the API response, the `/providers` screen, and every artifact
it produces — as simulated. Simulated media is a self-describing JSON
placeholder, never a fake binary passed off as real output. Configure
`ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` to
replace the idea/script and narration mocks with real ones; video, music,
and publishing stay vendor-neutral behind the generic HTTP adapter in
`src/providers/http/client.ts` until you point them at a real vendor.

### Testing

```bash
npm run typecheck
npm run lint
npm run test        # vitest — unit, integration, and Inngest-function tests
npm run build
```

To extend this project with Claude Code, paste
[`CLAUDE_CODE_MASTER_PROMPT.md`](./CLAUDE_CODE_MASTER_PROMPT.md) into a
session. The TypeScript files in `src/` define the canonical graph and
execution contract Claude should preserve.

## Non-negotiable production behavior

- Every run and every step is idempotent.
- External jobs use webhooks where available and bounded polling otherwise.
- Secrets remain server-side.
- Structured AI output is schema-validated.
- Failed steps retry with exponential backoff and then enter a dead-letter
  queue.
- Publication requires explicit approval unless tenant policy says
  otherwise.
- Every state transition is appended to an audit log.

## About DivinexAI Infrastructure OS

DivinexAI Infrastructure OS is the enterprise-grade AI operating system
powering the DivinexAI ecosystem. It provides shared infrastructure for AI
agents, payments, authentication, workflow orchestration, client
deployments, analytics, and vertical business operating systems across
industries. Atlas AI Video Factory is the first vertical pipeline built on
top of it.
