"use client";

import { SignalMeter } from "@/components/SignalMeter";
import { useLanguage } from "@/lib/i18n";

export function StatusRows({
  rows,
}: {
  rows: Array<{ label: string; ok: boolean | null; detail?: string }>;
}) {
  const { t } = useLanguage();
  return (
    <div className="divide-y divide-[var(--border)] rounded-xl bg-[var(--bg-elev)] px-4">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex min-h-10 items-center justify-between gap-3 py-2 text-sm"
        >
          <span>{row.label}</span>
          <span
            className="mono text-xs"
            style={{
              color:
                row.ok === null
                  ? "var(--muted)"
                  : row.ok
                    ? "var(--green)"
                    : "var(--yellow)",
            }}
          >
            {row.detail ?? (row.ok === null ? t("sensor.waiting") : row.ok ? t("sensor.ready") : t("sensor.adjust"))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CaptureMetrics({
  elapsedMs,
  targetMs,
  quality,
}: {
  elapsedMs: number;
  targetMs: number;
  quality: number;
}) {
  const { t } = useLanguage();
  const timePercent = Math.min(100, Math.round((elapsedMs / targetMs) * 100));
  return (
    <div className="space-y-3">
      <SignalMeter pct={timePercent} label={t("sensor.captureTime")} />
      <SignalMeter pct={Math.round(quality * 100)} label={t("common.quality")} />
    </div>
  );
}

export function CaptureError({ message }: { message: string }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="rounded-xl bg-[color-mix(in_srgb,var(--red)_12%,transparent)] p-4 text-sm">
      <div className="font-semibold text-[var(--red)]">{t("sensor.captureUnavailable")}</div>
      <p className="mt-1 text-[var(--text)]">{message}</p>
    </div>
  );
}
