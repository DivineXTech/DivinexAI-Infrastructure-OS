import type { AgentManifest } from "../manifest.js";
import { saraManifest } from "./sara.js";
import { novaManifest } from "./nova.js";
import { forgeManifest } from "./forge.js";
import { guardianManifest } from "./guardian.js";
import { revenManifest } from "./reven.js";
import { pulseManifest } from "./pulse.js";

export { saraManifest } from "./sara.js";
export { novaManifest } from "./nova.js";
export { forgeManifest } from "./forge.js";
export { guardianManifest } from "./guardian.js";
export { revenManifest } from "./reven.js";
export { pulseManifest } from "./pulse.js";

export const CANONICAL_AGENT_SLUGS = [
  "sara",
  "nova",
  "forge",
  "guardian",
  "reven",
  "pulse",
] as const;
export type CanonicalAgentSlug = (typeof CANONICAL_AGENT_SLUGS)[number];

/** All six canonical manifests, in the order they'd typically be provisioned. */
export const CANONICAL_AGENT_MANIFESTS: readonly AgentManifest[] = [
  saraManifest,
  novaManifest,
  forgeManifest,
  guardianManifest,
  revenManifest,
  pulseManifest,
];
