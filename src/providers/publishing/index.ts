import "server-only";
import { hasPublishingProviderCredentials } from "@/src/env";
import { httpPublishingProvider } from "@/src/providers/publishing/http";
import { mockPublishingProvider } from "@/src/providers/publishing/mock";
import type { PublishingProvider } from "@/src/providers/types";

export const publishingProvider: PublishingProvider = hasPublishingProviderCredentials()
  ? httpPublishingProvider
  : mockPublishingProvider;
