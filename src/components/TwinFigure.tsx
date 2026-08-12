"use client";

// Stylized human silhouette with highlightable organ systems.
// (Stands in for the 3D Twin in the PRD; deterministic + lightweight.)
import { SystemName, SystemState } from "@/lib/types";
import { PRIORITY_COLOR } from "@/lib/ui";

export function TwinFigure({
  states,
  active,
}: {
  states: Record<SystemName, SystemState>;
  active?: SystemName;
}) {
  const glow = (sys: SystemName) => {
    const c = PRIORITY_COLOR[states[sys]];
    const on = states[sys] !== "GREEN";
    return {
      fill: c,
      opacity: on ? 0.85 : 0.18,
      filter: on ? `drop-shadow(0 0 10px ${c})` : "none",
      stroke: active === sys ? "#fff" : "none",
      strokeWidth: active === sys ? 1.5 : 0,
    };
  };

  return (
    <svg viewBox="0 0 200 360" className="mx-auto h-full w-auto">
      {/* body silhouette */}
      <g fill="#16233a" stroke="#243b5e" opacity={0.95}>
        <circle cx="100" cy="42" r="26" fill="#16233a" />
        <rect x="72" y="72" width="56" height="120" rx="22" fill="#16233a" />
        <rect x="46" y="80" width="20" height="96" rx="10" fill="#16233a" />
        <rect x="134" y="80" width="20" height="96" rx="10" fill="#16233a" />
        <rect x="78" y="188" width="20" height="128" rx="10" fill="#16233a" />
        <rect x="102" y="188" width="20" height="128" rx="10" fill="#16233a" />
      </g>
      {/* neurological (head) */}
      <circle cx="100" cy="42" r="14" style={glow("neurological")} />
      {/* cardiovascular (heart) */}
      <path
        d="M100 112 c-8-12 -26-8 -26 6 c0 12 18 22 26 30 c8-8 26-18 26-30 c0-14 -18-18 -26-6 z"
        style={glow("cardiovascular")}
      />
      {/* respiratory (lungs) */}
      <g style={glow("respiratory")}>
        <ellipse cx="86" cy="120" rx="10" ry="20" />
        <ellipse cx="114" cy="120" rx="10" ry="20" />
      </g>
    </svg>
  );
}
