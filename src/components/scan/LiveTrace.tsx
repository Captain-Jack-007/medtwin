"use client";

import { useMemo } from "react";
import { useLanguage } from "@/lib/i18n";

export function LiveTrace({
  values,
  label,
  color = "var(--accent)",
  height = 96,
  emptyText,
}: {
  values: number[];
  label: string;
  color?: string;
  height?: number;
  emptyText?: string;
}) {
  const { t } = useLanguage();
  const path = useMemo(() => buildPath(values, 600, height), [values, height]);
  const resolvedEmptyText = emptyText ?? t("scan.acquiringSignal");
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-black/40">
      <div className="absolute left-3 top-2 z-10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </div>
      {path ? (
        <svg
          viewBox={`0 0 600 ${height}`}
          className="block w-full"
          style={{ height }}
          role="img"
          aria-label={`${label} ${t("scan.liveWaveform")}`}
        >
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div
          className="grid place-items-center text-sm text-[var(--muted)]"
          style={{ height }}
        >
          {resolvedEmptyText}
        </div>
      )}
    </div>
  );
}

function buildPath(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const visible = values.slice(-240);
  let minimum = Infinity;
  let maximum = -Infinity;
  for (const value of visible) {
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const span = Math.max(0.0001, maximum - minimum);
  return visible
    .map((value, index) => {
      const x = (index / Math.max(1, visible.length - 1)) * width;
      const normalized = (value - minimum) / span;
      const y = height * 0.82 - normalized * height * 0.64;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
