"use client";

// TwinLoading — premium loading state shown while the anatomical model streams
// (spec §32). Never leave an empty black canvas.
export function TwinLoading({ label = "Loading anatomy…" }: { label?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
      <div className="mono text-[11px] font-semibold tracking-[0.2em] text-[var(--accent)]">
        INITIALIZING DIGITAL TWIN
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
        <div className="twin-load-bar h-full w-1/3 rounded-full bg-[var(--accent)]" />
      </div>
      <div className="text-[10px] text-[var(--muted)]">{label}</div>
    </div>
  );
}
