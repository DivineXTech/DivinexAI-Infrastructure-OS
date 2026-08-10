import { NextResponse } from "next/server";
import { getProviderStatusReport, isRunningInSimulationMode } from "@/src/providers/health";

/** Live provider status for the /providers screen and external monitoring.
 *  Never returns a secret value — only capability, provider name, mode
 *  (real/simulated), state (missing/configured/healthy/failing), and a
 *  short human-readable detail string. */
export async function GET(): Promise<Response> {
  const reports = await getProviderStatusReport();
  return NextResponse.json({
    simulationMode: isRunningInSimulationMode(reports),
    providers: reports,
  });
}
