import "server-only";
import { hasMusicProviderCredentials } from "@/src/env";
import { httpMusicProvider } from "@/src/providers/music/http";
import { mockMusicProvider } from "@/src/providers/music/mock";
import type { MusicProvider } from "@/src/providers/types";

export const musicProvider: MusicProvider = hasMusicProviderCredentials()
  ? httpMusicProvider
  : mockMusicProvider;
