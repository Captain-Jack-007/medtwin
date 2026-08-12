"use client";

// Single contextual organ label for the 3D scene (spec §31, §32). In default
// mode the canvas stays clean — the three system cards below already carry
// per-system status. Only when the user SELECTS an organ do we show ONE label
// near the top-right identifying it. Positioned by CSS, not in-canvas.
import { SystemName, SystemState, SYSTEM_META } from "@/lib/types";
import { PRIORITY_COLOR } from "@/lib/ui";

const ORGAN_NAME: Record<SystemName, string> = {
  cardiovascular: "HEART",
  respiratory: "LUNGS",
  neurological: "BRAIN",
};

const STATE_WORD: Record<SystemState, string> = {
  GREEN: "LOW",
  YELLOW: "REVIEW",
  ORANGE: "ELEVATED",
  RED: "HIGH",
};

export function OrganLabels({
  states,
  onFocus,
  focus,
}: {
  states: Record<SystemName, SystemState>;
  onFocus?: (s: SystemName) => void;
  focus?: string;
}) {
  // Default/CLINICAL view: no floating cards at all — keep the canvas clean.
  if (focus !== "cardiovascular" && focus !== "respiratory" && focus !== "neurological")
    return null;
  const s = focus as SystemName;
  const col = PRIORITY_COLOR[states[s]];
  return (
    <div className="pointer-events-none absolute bottom-3 right-3 sm:bottom-auto sm:top-3">
      <button
        onClick={() => onFocus?.(s)}
        className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-md border bg-black/50 px-2.5 py-1.5 text-left backdrop-blur transition"
        style={{ borderColor: col }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: col, boxShadow: `0 0 6px ${col}` }}
        />
        <span className="leading-tight">
          <span className="mono block text-[10px] font-semibold tracking-wide">
            {ORGAN_NAME[s]}
          </span>
          <span className="block text-[9px] text-[var(--muted)]">
            {SYSTEM_META[s].label} · {STATE_WORD[states[s]]}
          </span>
        </span>
      </button>
    </div>
  );
}
