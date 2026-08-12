import { RealScanResult, SOURCE_LABEL } from "@/lib/measurements/types";
import { ScreeningSession } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

export function VitalsPanel({
  session,
  realScan,
  variant = "card",
}: {
  session: ScreeningSession;
  realScan?: RealScanResult;
  variant?: "card" | "workspace";
}) {
  const { t } = useLanguage();
  const containerClass = variant === "card" ? "panel p-4" : "";

  if (realScan) {
    return (
      <div className={containerClass}>
        <div className="tick mb-1">{t("vitals.observations")}</div>
        <div className="divide-y divide-[var(--border)]">
          <MeasurementRow
            label={t("vitals.heartRate")}
            value={formatValue(realScan.heartRate.value, "bpm")}
            source={sourceFor(realScan.heartRate.source, realScan.heartRate.algorithm)}
            quality={realScan.heartRate.signalQuality}
            status={realScan.heartRate.status}
          />
          <MeasurementRow
            label={t("vitals.respiration")}
            value={formatValue(realScan.respiratoryRate.value, "/min")}
            source={sourceFor(
              realScan.respiratoryRate.source,
              realScan.respiratoryRate.algorithm
            )}
            quality={realScan.respiratoryRate.signalQuality}
            status={realScan.respiratoryRate.status}
          />
          <MeasurementRow
            label={t("vitals.bloodPressure")}
            value={
              realScan.bloodPressure.value
                ? `${realScan.bloodPressure.value.systolic}/${realScan.bloodPressure.value.diastolic} mmHg`
                : t("common.notMeasured")
            }
            source={SOURCE_LABEL[realScan.bloodPressure.source]}
            quality={realScan.bloodPressure.signalQuality}
            status={realScan.bloodPressure.status}
          />
          <MeasurementRow
            label="SpO₂"
            value={formatValue(realScan.spo2.value, "%", t("common.externalDeviceRequired"))}
            source={SOURCE_LABEL[realScan.spo2.source]}
            quality={realScan.spo2.signalQuality}
            status={realScan.spo2.status}
          />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--muted)]">
          {t("vitals.rangeNote")}
        </p>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="tick">{t("vitals.observations")}</div>
        <span className="rounded-full border border-[var(--yellow)] px-2 py-0.5 text-[10px] font-semibold text-[var(--yellow)]">
          {t("vitals.demo")}
        </span>
      </div>
      <div className="mt-2 divide-y divide-[var(--border)]">
        <DemoRow label={t("vitals.heartRate")} value={session.heartRate} unit="bpm" />
        <DemoRow label={t("vitals.respiration")} value={session.respiratoryRate} unit="/min" />
        {session.systolic != null && session.diastolic != null && (
          <DemoRow
            label={t("vitals.bloodPressure")}
            value={`${session.systolic}/${session.diastolic}`}
            unit="mmHg"
          />
        )}
        {session.spo2 != null && (
          <DemoRow label="SpO₂" value={session.spo2} unit="%" />
        )}
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        {t("vitals.syntheticNote")}
      </p>
    </div>
  );
}

function MeasurementRow({
  label,
  value,
  source,
  quality,
  status,
}: {
  label: string;
  value: string;
  source: string;
  quality: number | null;
  status: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
          <span>{source}</span>
          {quality !== null && <span>{t("common.quality")} {Math.round(quality * 100)}%</span>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="mono text-base font-semibold">{value}</div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
          {status.replaceAll("_", " ")}
        </div>
      </div>
    </div>
  );
}

function DemoRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null;
  unit: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="tick">{label}</span>
      <span className="mono text-lg">
        {value ?? t("common.unavailable")}
        {value !== null && (
          <span className="ml-1 text-xs text-[var(--muted)]">{unit}</span>
        )}
      </span>
    </div>
  );
}

function formatValue(
  value: number | null,
  unit: string,
  unavailable = "UNABLE TO ESTIMATE"
): string {
  return value === null ? unavailable : `${value} ${unit}`;
}

function sourceFor(source: keyof typeof SOURCE_LABEL, algorithm: string | null) {
  if (algorithm === "camera_ppg_v1") return "Camera PPG";
  if (algorithm === "pose_respiration_v1") return "Camera / pose";
  return SOURCE_LABEL[source];
}
