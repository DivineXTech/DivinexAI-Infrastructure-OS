import { getProviderStatusReport, isRunningInSimulationMode } from "@/src/providers/health";
import type { ProviderState } from "@/src/providers/health";

export const dynamic = "force-dynamic";

const STATE_STYLES: Record<ProviderState, string> = {
  healthy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  configured: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  missing: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  failing: "bg-red-500/15 text-red-400 border-red-500/30",
};

const CAPABILITY_LABELS: Record<string, string> = {
  ai: "AI (ideas/scripts)",
  video: "Video generation",
  voice: "Narration (ElevenLabs)",
  music: "Music",
  storage: "Storage",
  publishing: "Publishing",
  composition: "Composition (Remotion + ffmpeg)",
};

export default async function ProvidersPage() {
  const reports = await getProviderStatusReport();
  const simulationMode = isRunningInSimulationMode(reports);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Provider Setup</h1>
        <p className="text-muted-foreground mt-1">
          Live status for every capability Atlas depends on. No secret values are
          ever shown here — only whether each capability is configured and healthy.
        </p>
      </div>

      {simulationMode ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-300">
          <strong>Simulation Mode active.</strong> One or more capabilities have no
          real vendor configured and are running against deterministic mock
          providers. Any media they produce is a clearly-labeled placeholder, never
          real generated content.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-300">
          Every capability is backed by a real, healthy provider.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Capability</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.capability} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  {CAPABILITY_LABELS[report.capability] ?? report.capability}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{report.providerName}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      report.mode === "real"
                        ? "rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400"
                        : "rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400"
                    }
                  >
                    {report.mode === "real" ? "real" : "simulated"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${STATE_STYLES[report.state]}`}
                  >
                    {report.state}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  {report.detail ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        Configure real vendors via environment variables — see{" "}
        <code className="rounded bg-muted px-1 py-0.5">.env.example</code>. This page
        also powers <code className="rounded bg-muted px-1 py-0.5">GET /api/providers/status</code>{" "}
        for external monitoring.
      </p>
    </main>
  );
}
