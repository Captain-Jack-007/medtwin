// Core domain types for MedTwin.
// Priority levels are TRIAGE priorities, not diagnoses.
import type { RealScanResult } from "./measurements/types";

export type Priority = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export type SystemName = "cardiovascular" | "neurological" | "respiratory";

export type SystemState = Priority; // per-system triage state

export type SignalQuality = "POOR" | "FAIR" | "GOOD";

export type DataSource = "measured" | "estimated" | "synthetic";

export interface PatientInfo {
  id: string;
  ageRange: string;
  sex: "M" | "F";
  location: string; // village id
  symptoms: string[];
  consent: boolean;
  createdAt: string;
}

export interface Vital {
  label: string;
  value: number | string;
  unit: string;
  source: DataSource;
  // optional flag: true if the reading is outside the configured screening band
  flagged?: boolean;
}

export interface ScreeningSession {
  patientId: string;
  heartRate: number | null; // bpm
  respiratoryRate: number | null; // /min
  faceSymmetry: boolean | null;
  armSymmetry: boolean | null;
  speechResult: boolean | null;
  signalQuality: SignalQuality;
  // optional simulated device data
  systolic?: number;
  diastolic?: number;
  spo2?: number;
}

export interface EvidenceItem {
  code: string;
  text: string;
  // whether this evidence comes from a simulated external device
  synthetic?: boolean;
  source?: string;
  quality?: number | null;
  contributes?: boolean;
}

export interface TriageResult {
  priority: Priority;
  systems: SystemName[];
  systemStates: Record<SystemName, SystemState>;
  observationStates: Record<SystemName, "NORMAL" | "ABNORMAL" | "UNKNOWN">;
  evidence: EvidenceItem[];
  recommendedAction: string;
  ruleVersion: string;
}

export interface DigitalTwin {
  patientId: string;
  cardiovascularState: SystemState;
  neurologicalState: SystemState;
  respiratoryState: SystemState;
}

export interface SynthPatient {
  info: PatientInfo;
  session: ScreeningSession;
  triage: TriageResult;
  dataMode?: "demo" | "real";
  realScan?: RealScanResult;
}

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type LocationType = "city" | "town" | "district_seat" | "demo_community";

export interface Village {
  id: string;
  name: string;
  x: number; // 0-100 abstract map coords (SVG fallback)
  y: number;
  // Real geographic coordinates (WGS84). Synthetic demo communities are
  // anchored near a real district centre and flagged with isSynthetic.
  lat: number;
  lng: number;
  type: LocationType;
  isSynthetic: boolean;
  screened: number;
  high: number; // high-priority patient count
  waitingSpecialist: number;
  online: boolean;
}

export type ClinicStatus =
  | "AVAILABLE"
  | "EN_ROUTE"
  | "ON_MISSION"
  | "OFFLINE";

export interface Clinic {
  id: string;
  label: string;
  status: ClinicStatus;
  x: number;
  y: number;
  lat: number;
  lng: number;
  capabilities: string[];
  targetVillageId?: string;
  etaMin?: number;
}

// Derive a categorical risk level from a village's high-priority load.
// Mirrors the SVG map's high-count buckets so markers stay consistent.
export function villageRiskLevel(v: {
  high: number;
  online: boolean;
}): RiskLevel {
  if (v.high >= 3) return "CRITICAL";
  if (v.high >= 2) return "HIGH";
  if (v.high >= 1) return "MODERATE";
  return "LOW";
}

export const RISK_COLOR: Record<RiskLevel, string> = {
  LOW: "var(--green)",
  MODERATE: "var(--yellow)",
  HIGH: "var(--orange)",
  CRITICAL: "var(--red)",
};

export interface DispatchRecommendation {
  clinicId: string;
  villageId: string;
  villageName: string;
  reasons: string[];
  highCount: number;
  systemBreakdown: Partial<Record<SystemName, number>>;
  etaMin: number;
}

export interface RegionStats {
  screened: number;
  high: number;
  waitingSpecialist: number;
  clinics: number;
  offlineVillages: number;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  GREEN: 0,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  GREEN: "No immediate warning detected",
  YELLOW: "Monitoring / routine review",
  ORANGE: "Professional assessment recommended",
  RED: "Urgent professional assessment recommended",
};

export const SYSTEM_META: Record<SystemName, { label: string }> = {
  cardiovascular: { label: "Cardiovascular" },
  neurological: { label: "Neurological" },
  respiratory: { label: "Respiratory" },
};
