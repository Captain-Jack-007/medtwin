// Navoiy region: villages and mobile clinics.
//
// GEOGRAPHY IS REAL, MEDICAL DATA IS SYNTHETIC.
// - lat/lng are verified real-world coordinates (WGS84) for the named towns
//   (sources recorded in docs/GEOGRAPHY.md). Patient/screening numbers are
//   synthetic demo data.
// - "Village A–D" are synthetic demo communities (isSynthetic: true), anchored
//   near a real district seat so they render on the map without claiming to be
//   a real settlement. They are labelled DEMO LOCATION in the UI.
// - x/y are the legacy 0-100 abstract layout coords used by the SVG fallback
//   map and the deterministic ETA model; they are preserved unchanged.
import { Clinic, Village } from "./types";

export const VILLAGES: Village[] = [
  { id: "v-a", name: "Village A", type: "demo_community", isSynthetic: true, x: 30, y: 22, lat: 40.310, lng: 65.470, screened: 32, high: 0, waitingSpecialist: 4, online: true },
  { id: "v-b", name: "Village B", type: "demo_community", isSynthetic: true, x: 14, y: 46, lat: 40.020, lng: 65.010, screened: 18, high: 2, waitingSpecialist: 6, online: true },
  { id: "v-c", name: "Village C", type: "demo_community", isSynthetic: true, x: 52, y: 62, lat: 40.360, lng: 65.560, screened: 14, high: 3, waitingSpecialist: 5, online: true },
  { id: "v-d", name: "Village D", type: "demo_community", isSynthetic: true, x: 74, y: 40, lat: 40.680, lng: 65.520, screened: 21, high: 1, waitingSpecialist: 3, online: true },
  { id: "v-e", name: "Qiziltepa", type: "city", isSynthetic: false, x: 44, y: 30, lat: 40.040, lng: 64.850, screened: 27, high: 1, waitingSpecialist: 4, online: true },
  { id: "v-f", name: "Nurota", type: "city", isSynthetic: false, x: 66, y: 18, lat: 40.568, lng: 65.679, screened: 19, high: 0, waitingSpecialist: 2, online: true },
  { id: "v-g", name: "Konimex", type: "town", isSynthetic: false, x: 22, y: 70, lat: 40.276, lng: 65.145, screened: 11, high: 1, waitingSpecialist: 3, online: false },
  { id: "v-h", name: "Tomdi", type: "district_seat", isSynthetic: false, x: 84, y: 66, lat: 41.751, lng: 64.617, screened: 8, high: 0, waitingSpecialist: 1, online: false },
  { id: "v-i", name: "Uchquduq", type: "city", isSynthetic: false, x: 60, y: 82, lat: 42.170, lng: 63.460, screened: 16, high: 2, waitingSpecialist: 5, online: true },
  { id: "v-j", name: "Karmana", type: "town", isSynthetic: false, x: 38, y: 50, lat: 40.210, lng: 65.370, screened: 24, high: 1, waitingSpecialist: 4, online: true },
];

// Navoiy city centre — used to frame the default map view.
export const NAVOIY_CENTER = { lat: 40.104, lng: 65.373 };

export const CLINICS: Clinic[] = [
  { id: "clinic-01", label: "CLINIC-01", status: "AVAILABLE", x: 40, y: 40, lat: 40.240, lng: 65.360, capabilities: ["general", "cardiology"] },
  { id: "clinic-02", label: "CLINIC-02", status: "AVAILABLE", x: 48, y: 44, lat: 40.180, lng: 65.420, capabilities: ["general", "cardiology", "neurology"] },
  { id: "clinic-03", label: "CLINIC-03", status: "ON_MISSION", x: 70, y: 30, lat: 40.560, lng: 65.500, capabilities: ["general", "cardiology"], targetVillageId: "v-d" },
  { id: "clinic-04", label: "CLINIC-04", status: "OFFLINE", x: 20, y: 60, lat: 40.150, lng: 65.020, capabilities: ["general"] },
];

export function villageById(id: string): Village | undefined {
  return VILLAGES.find((v) => v.id === id);
}

export function clinicById(id: string): Clinic | undefined {
  return CLINICS.find((c) => c.id === id);
}

// Rough straight-line distance -> minutes (synthetic travel model).
export function estimateEtaMin(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return Math.round(6 + d * 1.1);
}
