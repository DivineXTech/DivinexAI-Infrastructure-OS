# DivinexAI Integration

Interfaces for future DivinexAI ecosystem services live in
`lib/divinexai/types.ts` (`DivinexAIAssistant`). Only a mock implementation
(`lib/divinexai/mock-assistant.ts`) exists today — it returns clearly
templated placeholder text with no external calls.

## Current methods (Phase 1 stub surface)

| Method | Maps to | Real endpoint |
|---|---|---|
| `suggestBrandNames` | Brand-name generation | Not connected |
| `generateProductDescription` | Product-description generation | Not connected |
| `generateSocialCopy` | Social-media copy | Not connected |
| `recommendStartupKit` | Startup-kit recommendation | Not connected (also see pricing/startup-kit logic in Phase 7) |

Other services named in the product spec — Sara business assistant,
customer support, sales forecasting, inventory forecasting, production
scheduling, supplier recommendations, image generation, workflow
automation — do not have interfaces defined yet; add them to
`lib/divinexai/types.ts` as the phase that needs them starts, following
the same pattern (interface method + mock implementation + a resolver in
`lib/divinexai/index.ts`).

## Resolution

`getDivinexAIAssistant()` (`lib/divinexai/index.ts`) returns the mock
unless both `DIVINEXAI_API_BASE_URL` and `DIVINEXAI_API_KEY` are set, in
which case it currently **throws** — a real HTTP-backed implementation
still needs to be written before those credentials do anything. This is
intentional: it's louder than silently falling back to the mock while
looking configured.

## Adding a real implementation

1. Write a class implementing `DivinexAIAssistant` against the real
   DivinexAI API (new file, e.g. `lib/divinexai/live-assistant.ts`).
2. Swap the `throw` in `getDivinexAIAssistant()` for constructing that
   class.
3. Never call it from a Client Component — it must only run server-side
   (the module already imports `server-only`).
4. Never surface `DIVINEXAI_API_KEY` to the client.
