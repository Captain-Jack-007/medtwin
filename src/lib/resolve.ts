// Resolve a patient id -> SynthPatient from scenarios, population, or a live
// client scan (sessionStorage). Safe to call on the client.
import { getScenario } from "./scenarios";
import { getPopulation } from "./patients";
import { loadRealScan } from "./measurements/store";
import { SynthPatient } from "./types";
import { realScanToPatient } from "./production/patient";

export function resolvePatient(id: string): SynthPatient | undefined {
  const scan = loadRealScan();
  if (scan?.id === id) {
    return realScanToPatient(scan.result);
  }

  const scenario = getScenario(id);
  if (scenario) return { ...scenario, dataMode: "demo" };

  const fromPop = getPopulation().find((p) => p.info.id === id);
  if (fromPop) return { ...fromPop, dataMode: "demo" };
  return undefined;
}
