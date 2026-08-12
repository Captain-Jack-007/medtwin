"use client";

import { useLanguage } from "@/lib/i18n";

export function SignalMeter({ pct, label }: { pct: number; label?: string }) {
  const { t } = useLanguage();
  const bounded = Math.max(0, Math.min(100, Math.round(pct)));
  const color =
    bounded >= 80
      ? "var(--green)"
      : bounded >= 55
        ? "var(--yellow)"
        : "var(--red)";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
        <span className="tick">{label ?? t("common.quality")}</span>
        <span className="mono" style={{ color }}>
          {bounded}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elev)]">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${bounded}%`, background: color }}
        />
      </div>
    </div>
  );
}
