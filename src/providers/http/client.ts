import "server-only";

/** Thin JSON fetch helper shared by the generic vendor-neutral HTTP
 *  provider adapters (video, music, publishing). Every real vendor
 *  integration is expected to speak this minimal REST contract:
 *    POST {baseUrl}/jobs        -> { jobId }
 *    GET  {baseUrl}/jobs/{id}   -> { status, assetUrl?, costUsd?, error? }
 *    GET  {baseUrl}/health      -> 200 when reachable and authorized
 *  A vendor that doesn't natively speak this contract needs a small proxy
 *  in front of it — see CLAUDE_CODE_MASTER_PROMPT.md for the pattern. */
export async function httpProviderRequest<T>(input: {
  baseUrl: string;
  path: string;
  apiKey: string;
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000);

  try {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}${input.path}`, {
      method: input.method ?? "GET",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText);
      throw new Error(`Provider request to ${input.path} failed (${response.status}): ${detail}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function httpProviderHealthCheck(input: {
  baseUrl: string;
  apiKey: string;
}): Promise<{ healthy: boolean; detail?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/health`, {
        headers: { Authorization: `Bearer ${input.apiKey}` },
        signal: controller.signal,
      });
      return response.ok
        ? { healthy: true }
        : { healthy: false, detail: `Health check returned HTTP ${response.status}` };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      healthy: false,
      detail: error instanceof Error ? error.message : "Unknown provider health error",
    };
  }
}
