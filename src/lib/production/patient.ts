import type { RealScanResult } from "@/lib/measurements/types";
import { realScanToSession, runRealTriage } from "@/lib/triage";
import type { PatientInfo, SynthPatient } from "@/lib/types";

export function realScanToPatient(result: RealScanResult): SynthPatient {
  const info: PatientInfo = {
    id: result.sessionId,
    ageRange: result.demographics.ageRange,
    sex: result.demographics.sex,
    location: result.demographics.location,
    symptoms: result.symptoms,
    consent: true,
    createdAt: result.completedAt,
  };

  return {
    info,
    session: realScanToSession(result),
    triage: runRealTriage(result),
    dataMode: "real",
    realScan: result,
  };
}
