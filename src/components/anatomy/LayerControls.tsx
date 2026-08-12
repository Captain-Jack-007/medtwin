"use client";

// LayerControls — compact BODY / ORGANS / SKELETON + X-RAY toggles (spec §27).
// HTML overlay outside the canvas; kept small so it never clutters the view.
import type { AnatomyLayers } from "./HumanAnatomyScene";

export function LayerControls({
  layers,
  onLayers,
  xray,
  onXray,
}: {
  layers: AnatomyLayers;
  onLayers: (l: AnatomyLayers) => void;
  xray: boolean;
  onXray: (v: boolean) => void;
}) {
  const chip = (on: boolean, disabled = false) =>
    [
      "pointer-events-auto min-h-9 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide transition sm:min-h-0",
      disabled ? "opacity-40" : "hover:brightness-125",
      on
        ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
        : "border-[var(--border)] text-[var(--muted)] bg-black/40",
    ].join(" ");

  return (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
      <button
        type="button"
        className={chip(layers.body)}
        onClick={() => onLayers({ ...layers, body: !layers.body })}
      >
        BODY {layers.body ? "✓" : ""}
      </button>
      <button
        type="button"
        className={chip(layers.organs)}
        onClick={() => onLayers({ ...layers, organs: !layers.organs })}
      >
        ORGANS {layers.organs ? "✓" : ""}
      </button>
      <button
        type="button"
        className={chip(layers.skeleton)}
        onClick={() => onLayers({ ...layers, skeleton: !layers.skeleton })}
        title="Show the skeletal layer"
      >
        SKELETON {layers.skeleton ? "✓" : ""}
      </button>
      <button type="button" className={chip(xray)} onClick={() => onXray(!xray)}>
        X-RAY {xray ? "✓" : ""}
      </button>
    </div>
  );
}
