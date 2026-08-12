// AI resource prioritization + mobile-clinic dispatch (deterministic).
import { CLINICS, VILLAGES, estimateEtaMin } from "./region";
import { getPopulation } from "./patients";
import {
  DispatchRecommendation,
  PRIORITY_ORDER,
  RegionStats,
  SystemName,
  Village,
} from "./types";

// Aggregate synthetic population back onto villages for high-priority counts
// and per-system breakdowns.
export function villageSystemBreakdown(): Record<string, Partial<Record<SystemName, number>>> {
  const map: Record<string, Partial<Record<SystemName, number>>> = {};
  for (const p of getPopulation()) {
    if (PRIORITY_ORDER[p.triage.priority] < PRIORITY_ORDER["ORANGE"]) continue;
    const vid = p.info.location;
    map[vid] ??= {};
    for (const sys of p.triage.systems) {
      map[vid][sys] = (map[vid][sys] ?? 0) + 1;
    }
  }
  return map;
}

export function regionStats(): RegionStats {
  const high = VILLAGES.reduce((a, v) => a + v.high, 0);
  return {
    screened: 1284, // headline demo figure (PRD §17)
    high,
    waitingSpecialist: 37,
    clinics: CLINICS.filter((c) => c.status !== "OFFLINE").length,
    offlineVillages: VILLAGES.filter((v) => !v.online).length,
  };
}

// Score a village: weight high count, then RED-ness, penalize offline.
function villageScore(v: Village): number {
  return v.high * 10 + (v.online ? 0 : -1);
}

// Recommend which available clinic to send to the highest-need village.
export function recommendDispatch(): DispatchRecommendation | null {
  const target = [...VILLAGES]
    .filter((v) => v.high > 0)
    .sort((a, b) => villageScore(b) - villageScore(a))[0];
  if (!target) return null;

  const available = CLINICS.filter((c) => c.status === "AVAILABLE");
  if (available.length === 0) return null;

  const clinic = available
    .map((c) => ({ c, eta: estimateEtaMin(c, target) }))
    .sort((a, b) => a.eta - b.eta)[0];

  const breakdown = villageSystemBreakdown()[target.id] ?? {};
  const reasons: string[] = [];
  reasons.push(`${target.high} high-priority patient(s) waiting`);
  const parts = Object.entries(breakdown).map(([k, n]) => `${n} ${k}`);
  if (parts.length) reasons.push(parts.join(", "));
  if (!target.online) reasons.push("village currently offline — sync pending");

  return {
    clinicId: clinic.c.id,
    villageId: target.id,
    villageName: target.name,
    reasons,
    highCount: target.high,
    systemBreakdown: breakdown,
    etaMin: clinic.eta,
  };
}
