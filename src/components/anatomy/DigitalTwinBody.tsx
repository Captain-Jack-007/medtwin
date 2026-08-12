"use client";

// DigitalTwinBody — top-level Digital Twin visual. The shipped anatomical GLB
// is the only patient-twin renderer; no alternate figure is substituted.
import { Suspense } from "react";
import { SystemName, SystemState } from "@/lib/types";
import {
  AnatomyLayers,
  DEFAULT_LAYERS,
  FocusTarget,
  HumanAnatomyScene,
} from "./HumanAnatomyScene";
import { useMounted } from "@/lib/useMounted";
import { TwinLoading } from "./TwinLoading";
import type { OrganSystem, RiskLevel } from "@/lib/pharma/types";

export function DigitalTwinBody({
  states,
  focus = "body",
  heartRate,
  respiratoryRate,
  layers = DEFAULT_LAYERS,
  xray = false,
  presentation = false,
  pharmaOrganRisks,
}: {
  states: Record<SystemName, SystemState>;
  active?: SystemName;
  focus?: FocusTarget;
  heartRate?: number;
  respiratoryRate?: number;
  layers?: AnatomyLayers;
  xray?: boolean;
  presentation?: boolean;
  pharmaOrganRisks?: Partial<Record<OrganSystem, RiskLevel>>;
}) {
  const mounted = useMounted();
  if (!mounted) return <TwinLoading />;

  return (
    <Suspense fallback={<TwinLoading />}>
      <HumanAnatomyScene
        states={states}
        focus={focus}
        heartRate={heartRate}
        respiratoryRate={respiratoryRate}
        layers={layers}
        xray={xray}
        presentation={presentation}
        pharmaOrganRisks={pharmaOrganRisks}
      />
    </Suspense>
  );
}
