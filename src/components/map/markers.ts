// Custom MedTwin map markers built as Leaflet DivIcons (HTML), so we avoid
// Leaflet's default PNG pin assets entirely (spec §37/§38).
import L from "leaflet";
import { ClinicStatus, RiskLevel } from "@/lib/types";

const RISK_HEX: Record<RiskLevel, string> = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
};

const CLINIC_HEX: Record<ClinicStatus, string> = {
  AVAILABLE: "#2dd4bf",
  EN_ROUTE: "#38bdf8",
  ON_MISSION: "#eab308",
  OFFLINE: "#64748b",
};

// A circular risk marker with an optional high-priority count badge.
export function riskDivIcon(
  risk: RiskLevel,
  highPriority: number,
  selected: boolean
): L.DivIcon {
  const c = RISK_HEX[risk];
  const pulse = risk === "CRITICAL" || risk === "HIGH";
  const ring = selected
    ? `box-shadow:0 0 0 3px rgba(255,255,255,0.9),0 0 12px ${c};`
    : `box-shadow:0 0 10px ${c}99;`;
  const badge =
    highPriority > 0
      ? `<span style="position:absolute;top:-8px;right:-8px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:${c};color:#0b1220;font:700 10px/16px ui-monospace,monospace;text-align:center;border:1.5px solid #0b1220;">${highPriority}</span>`
      : "";
  const html = `
    <div class="mt-risk-marker ${pulse ? "mt-pulse" : ""}" style="position:relative;">
      <span style="display:block;width:18px;height:18px;border-radius:50%;background:${c};border:2px solid #0b1220;${ring}"></span>
      ${badge}
    </div>`;
  return L.divIcon({
    html,
    className: "mt-divicon",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

// A square teal-family clinic marker — distinct visual language from risk dots.
export function clinicDivIcon(status: ClinicStatus): L.DivIcon {
  const c = CLINIC_HEX[status];
  const html = `
    <div class="mt-clinic-marker" style="position:relative;">
      <span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:5px;background:${c}22;border:2px solid ${c};box-shadow:0 0 8px ${c}66;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 13h13v-2a2 2 0 0 0-2-2H3z"/><path d="M16 9h3l2 3v2h-5z"/>
          <circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>
        </svg>
      </span>
    </div>`;
  return L.divIcon({
    html,
    className: "mt-divicon",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

// A small moving marker used during the dispatch animation.
export function movingClinicDivIcon(): L.DivIcon {
  const c = CLINIC_HEX.EN_ROUTE;
  const html = `
    <div style="position:relative;">
      <span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:${c};box-shadow:0 0 12px ${c};">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0b1220" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 13h13v-2a2 2 0 0 0-2-2H3z"/><path d="M16 9h3l2 3v2h-5z"/>
          <circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>
        </svg>
      </span>
    </div>`;
  return L.divIcon({
    html,
    className: "mt-divicon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
