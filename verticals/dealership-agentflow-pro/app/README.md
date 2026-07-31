# AgentFlow Pro — Dealership App

The branded Dealership App: the Command Center dashboard and GM's Daily Report that the
[Sales Floor Director orchestrator](../agents/00-sales-floor-director.md) publishes to
every morning. React + TypeScript + Tailwind, built with Vite.

Currently a UI prototype against sample data (`src/data/sampleData.ts`) — wire it to the
orchestrator's report API for production use.

## White-labeling

- `dealershipName` and all sample data live in `src/data/sampleData.ts` — swap for a live
  data source per dealership.
- Brand color is set via the `--color-brand` CSS variable in `src/index.css`; swap for
  the dealership's brand color on the Pro tier (full white-label, see
  [`../pricing/PRICING.md`](../pricing/PRICING.md)).

## Run it

```sh
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
```
