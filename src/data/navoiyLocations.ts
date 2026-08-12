// Geographic PRESENTATION layer for the Control Tower map.
//
// REAL GEOGRAPHY, SYNTHETIC MEDICAL DATA.
// - latitude/longitude are verified real-world coordinates (WGS84). Sources are
//   recorded in docs/GEOGRAPHY.md. Do NOT approximate coordinates visually.
// - All patient/screening figures are synthetic hackathon demo data
//   (isSyntheticMedicalData: true). They are NOT provided by any health
//   authority and do not correspond to real residents.
// - This layer intentionally does NOT own the safety-critical dispatch ids or
//   logic. It joins onto the existing region ids (v-a … v-j, clinic-0x) so the
//   deterministic engine in src/lib/dispatch.ts and its tests are untouched.
import { CLINICS, VILLAGES } from "@/lib/region";
import { villageSystemBreakdown } from "@/lib/dispatch";
import { ClinicStatus, RiskLevel, SystemName } from "@/lib/types";

export type LocationKind = "city" | "district" | "clinic" | "demo-community";

export interface MedTwinLocation {
  id: string; // joins region village id
  name: string;
  latitude: number;
  longitude: number;
  type: LocationKind;
  isSyntheticMedicalData: boolean;
  screenedPatients: number;
  highPriority: number;
  waitingSpecialist: number;
  cardiovascular: number;
  respiratory: number;
  neurological: number;
}

// Real place / demo-community names + verified coordinates, keyed by region id.
// (Coordinates duplicated from region.ts lat/lng so this file is a single
// explicit geographic source, per the spec.)
// Demo communities (v-a…v-d) are clearly-marked synthetic settlements anchored
// near — but not on top of — a real district seat. Real cities/districts
// (v-e…v-j) carry verified WGS84 coordinates from region.ts.
const PLACE: Record<
  string,
  { name: string; type: LocationKind; lat: number; lng: number }
> = {
  "v-a": { name: "Demo Community A", type: "demo-community", lat: 40.31, lng: 65.47 },
  "v-b": { name: "Demo Community B", type: "demo-community", lat: 40.02, lng: 65.01 },
  "v-c": { name: "Demo Community C", type: "demo-community", lat: 40.36, lng: 65.56 },
  "v-d": { name: "Demo Community D", type: "demo-community", lat: 40.68, lng: 65.52 },
  "v-e": { name: "Qiziltepa", type: "city", lat: 40.04, lng: 64.85 },
  "v-f": { name: "Nurota", type: "city", lat: 40.568, lng: 65.679 },
  "v-g": { name: "Konimex", type: "district", lat: 40.276, lng: 65.145 },
  "v-h": { name: "Tomdi", type: "district", lat: 41.751, lng: 64.617 },
  "v-i": { name: "Uchquduq", type: "city", lat: 42.17, lng: 63.46 },
  "v-j": { name: "Karmana", type: "city", lat: 40.21, lng: 65.37 },
};

// Aggregate per-system counts (ORANGE+ patients) from the synthetic population.
function systemCounts(): Record<string, Partial<Record<SystemName, number>>> {
  return villageSystemBreakdown();
}

export function getMedTwinLocations(): MedTwinLocation[] {
  const breakdown = systemCounts();
  return VILLAGES.map((v) => {
    const place = PLACE[v.id];
    const b = breakdown[v.id] ?? {};
    return {
      id: v.id,
      name: place.name,
      latitude: place.lat,
      longitude: place.lng,
      type: place.type,
      isSyntheticMedicalData: true,
      screenedPatients: v.screened,
      highPriority: v.high,
      waitingSpecialist: v.waitingSpecialist,
      cardiovascular: b.cardiovascular ?? 0,
      respiratory: b.respiratory ?? 0,
      neurological: b.neurological ?? 0,
    };
  });
}

export interface MedTwinClinic {
  id: string;
  label: string;
  status: ClinicStatus;
  latitude: number;
  longitude: number;
  anchorName: string; // real aggregation location it starts near
}

// Simulated mobile clinics anchored at real aggregation locations.
const CLINIC_ANCHOR: Record<string, string> = {
  "clinic-01": "Navoiy",
  "clinic-02": "Karmana",
  "clinic-03": "Nurota",
  "clinic-04": "Qiziltepa",
};

export function getMedTwinClinics(): MedTwinClinic[] {
  return CLINICS.map((c) => ({
    id: c.id,
    label: c.label,
    status: c.status,
    latitude: c.lat,
    longitude: c.lng,
    anchorName: CLINIC_ANCHOR[c.id] ?? "Navoiy",
  }));
}

// Centralized, deterministic risk thresholds (spec §9).
export const RISK_THRESHOLDS = { critical: 3, high: 2, moderate: 1 } as const;

export function riskFor(loc: {
  highPriority: number;
  waitingSpecialist: number;
}): RiskLevel {
  if (loc.highPriority >= RISK_THRESHOLDS.critical) return "CRITICAL";
  if (loc.highPriority >= RISK_THRESHOLDS.high) return "HIGH";
  if (loc.highPriority >= RISK_THRESHOLDS.moderate || loc.waitingSpecialist > 4)
    return "MODERATE";
  return "LOW";
}

// Bounding box over all real/demo locations, for fitBounds default camera.
export function locationBounds(
  locs: MedTwinLocation[]
): [[number, number], [number, number]] {
  const lats = locs.map((l) => l.latitude);
  const lngs = locs.map((l) => l.longitude);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}
