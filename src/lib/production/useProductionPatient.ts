"use client";

import { useEffect, useState } from "react";
import type { SynthPatient } from "@/lib/types";
import type { RealScanResult } from "@/lib/measurements/types";
import { isBrowserProductionDataMode } from "@/lib/supabase/env";
import { realScanToPatient } from "./patient";

export type ProductionPatientStatus = "idle" | "loading" | "ready" | "not_found" | "error";

export function useProductionPatient(id: string, audience: "patient" | "clinician") {
  const productionMode = isBrowserProductionDataMode();
  const [state, setState] = useState<{
    key: string | null;
    patient: SynthPatient | null;
    status: ProductionPatientStatus;
  }>({ key: null, patient: null, status: "idle" });

  useEffect(() => {
    if (!productionMode) return;
    const controller = new AbortController();

    void fetch(`/api/records/${encodeURIComponent(id)}?audience=${audience}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !isStoredResult(body)) throw new Error("Record unavailable");
        return realScanToPatient(body.result);
      })
      .then((nextPatient) => {
        setState({ key: requestKey(id, audience), patient: nextPatient, status: "ready" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ key: requestKey(id, audience), patient: null, status: "not_found" });
      });

    return () => controller.abort();
  }, [audience, id, productionMode]);

  const key = requestKey(id, audience);
  if (!productionMode) return { patient: null, status: "idle" as const };
  if (state.key !== key) return { patient: null, status: "loading" as const };
  return { patient: state.patient, status: state.status };
}

function requestKey(id: string, audience: "patient" | "clinician") {
  return `${audience}:${id}`;
}

function isStoredResult(value: unknown): value is { result: RealScanResult } {
  return typeof value === "object" && value !== null && "result" in value;
}
