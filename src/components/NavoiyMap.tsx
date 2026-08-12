"use client";

// SVG map of the Navoiy region: villages colored by priority, clinics, and an
// animated clinic moving to a dispatch target.
import { CLINICS, VILLAGES, clinicById } from "@/lib/region";
import { DispatchRecommendation, Village } from "@/lib/types";

function villagePriorityColor(v: Village): string {
  if (v.high >= 3) return "var(--red)";
  if (v.high >= 2) return "var(--orange)";
  if (v.high >= 1) return "var(--yellow)";
  return "var(--green)";
}

export function NavoiyMap({
  dispatched,
  onSelect,
}: {
  dispatched?: DispatchRecommendation | null;
  onSelect?: (villageId: string) => void;
}) {
  const target = dispatched
    ? VILLAGES.find((v) => v.id === dispatched.villageId)
    : undefined;
  const clinic = dispatched ? clinicById(dispatched.clinicId) : undefined;

  return (
    <div className="panel relative overflow-hidden">
      <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* subtle grid */}
        {Array.from({ length: 10 }).map((_, i) => (
          <g key={i} stroke="var(--border)" strokeWidth={0.15}>
            <line x1={i * 10} y1={0} x2={i * 10} y2={100} />
            <line x1={0} y1={i * 10} x2={100} y2={i * 10} />
          </g>
        ))}

        {/* dispatch route */}
        {target && clinic && (
          <line
            x1={clinic.x} y1={clinic.y} x2={target.x} y2={target.y}
            stroke="var(--accent)" strokeWidth={0.5} strokeDasharray="1.5 1.5"
          />
        )}

        {/* villages */}
        {VILLAGES.map((v) => (
          <g key={v.id} onClick={() => onSelect?.(v.id)} style={{ cursor: onSelect ? "pointer" : "default" }}>
            <circle
              cx={v.x} cy={v.y} r={2.6}
              fill={villagePriorityColor(v)}
              opacity={v.online ? 0.95 : 0.4}
              className={v.high >= 3 ? "live-dot" : ""}
            />
            <text x={v.x} y={v.y - 3.5} fill="var(--muted)" fontSize={2.4} textAnchor="middle">
              {v.name}
            </text>
            <text x={v.x} y={v.y + 5} fill="var(--text)" fontSize={2.6} textAnchor="middle" className="mono">
              {v.screened}
            </text>
          </g>
        ))}

        {/* clinics */}
        {CLINICS.map((c) => (
          <g key={c.id}>
            <rect x={c.x - 1.6} y={c.y - 1.6} width={3.2} height={3.2} rx={0.6}
              fill={c.status === "OFFLINE" ? "var(--muted)" : "var(--accent-2, #38bdf8)"}
              opacity={c.status === "OFFLINE" ? 0.4 : 0.9} />
          </g>
        ))}

        {/* animated dispatched clinic */}
        {target && clinic && (
          <circle r={1.8} fill="#fff">
            <animate attributeName="cx" from={clinic.x} to={target.x} dur="3s" repeatCount="indefinite" />
            <animate attributeName="cy" from={clinic.y} to={target.y} dur="3s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      <div className="pointer-events-none absolute left-3 top-3">
        <span className="tick">Navoiy region</span>
      </div>
    </div>
  );
}
