import "server-only";

/**
 * Central provider registry. Each capability's own index module
 * (src/providers/{ai,video,voice,music,storage,publishing}/index.ts) picks
 * a real vendor adapter or a deterministic mock based on src/env.ts — swap
 * a vendor there and every workflow step that depends on that capability
 * picks it up automatically. This module just re-exports the selected
 * instances as a single, stable import surface for workflow code.
 */
export { aiProvider } from "@/src/providers/ai";
export { videoProvider } from "@/src/providers/video";
export { voiceProvider } from "@/src/providers/voice";
export { musicProvider } from "@/src/providers/music";
export { storageProvider } from "@/src/providers/storage";
export { publishingProvider } from "@/src/providers/publishing";
