import "server-only";
import { hasVideoProviderCredentials } from "@/src/env";
import { httpVideoProvider } from "@/src/providers/video/http";
import { mockVideoProvider } from "@/src/providers/video/mock";
import type { VideoProvider } from "@/src/providers/types";

export const videoProvider: VideoProvider = hasVideoProviderCredentials()
  ? httpVideoProvider
  : mockVideoProvider;
