"use client";

import Link from "next/link";
import { PatientResultsAIPanel } from "@/components/results/PatientResultsAIPanel";
import { derivePatientResult, type PatientMeasurementStatus } from "@/lib/patient-results";
import { useLanguage } from "@/lib/i18n";
import type { SynthPatient } from "@/lib/types";

const tone: Record<PatientMeasurementStatus, string> = {
  measured_normal: "var(--green)",
  measured_abnormal: "var(--yellow)",
  not_measured: "var(--muted)",
  device_required: "var(--muted)",
  unavailable: "var(--muted)",
};

export function PatientResultsView({ patient }: { patient: SynthPatient }) {
  const { t } = useLanguage();
  const summary = derivePatientResult(patient);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-5 sm:py-12">
      <header className="border-b border-[var(--border)] pb-6">
        <span className="tick">{t("results.title")}</span>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mono text-3xl font-bold tracking-[-0.025em]">
              {patient.info.id}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {patient.dataMode === "demo" ? t("results.syntheticPatient") : t("patient.syntheticPatient")}
            </p>
          </div>
          <Link href={`/clinical/${patient.info.id}`} className="sensor-secondary-button inline-flex w-full items-center justify-center sm:w-auto">
            {t("results.shareDoctor")}
          </Link>
        </div>
      </header>

      <section className="mt-7 border-y border-[var(--border)] py-6">
        <p className="tick">{t("results.overall")}</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em]" style={{ color: resultColor(summary.status) }}>
          {resultTitle(t, summary.status)}
        </h2>
        {summary.status === "incomplete" ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            {t("results.incompleteDescription")}
          </p>
        ) : summary.status === "no_warning_detected" ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            {t("results.noSignalsDescription")}
          </p>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("results.measurements")}</h2>
        <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4">
          {summary.measurements.map((measurement) => (
            <div key={measurement.key} className="flex items-center justify-between gap-5 py-4">
              <div>
                <p className="text-sm font-medium">{measurementLabel(t, measurement.key)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{measurementStatus(t, measurement.status)}</p>
              </div>
              <p className="mono text-right text-sm font-semibold" style={{ color: tone[measurement.status] }}>
                {measurement.value ?? measurementStatus(t, measurement.status)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
        <div className="rounded-xl bg-[var(--bg-elev)] p-5">
          <h2 className="text-lg font-semibold">{t("results.yourResults")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            {summary.detectedSignalCount === 0
              ? t("results.noSignalsDescription")
              : resultTitle(t, summary.status)}
          </p>
          {summary.unavailableMeasurementCount > 0 && (
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              {t("results.unavailableDescription")}
            </p>
          )}
        </div>
        <PatientResultsAIPanel patientId={patient.info.id} summary={summary} />
      </section>
    </main>
  );
}

function measurementLabel(t: ReturnType<typeof useLanguage>["t"], key: string) {
  return {
    heart_rate: t("vitals.heartRate"),
    respiratory_rate: t("vitals.respiration"),
    blood_pressure: t("vitals.bloodPressure"),
    spo2: "SpO₂",
  }[key] ?? key;
}

function measurementStatus(t: ReturnType<typeof useLanguage>["t"], status: PatientMeasurementStatus) {
  return {
    measured_normal: t("results.measuredNormal"),
    measured_abnormal: t("results.measuredAbnormal"),
    not_measured: t("results.notMeasured"),
    device_required: t("results.deviceRequired"),
    unavailable: t("results.unavailable"),
  }[status];
}

function resultTitle(t: ReturnType<typeof useLanguage>["t"], status: ReturnType<typeof derivePatientResult>["status"]) {
  return {
    no_warning_detected: t("results.noWarning"),
    review_needed: t("results.reviewNeeded"),
    urgent_review_needed: t("results.urgentReview"),
    incomplete: t("results.incomplete"),
  }[status];
}

function resultColor(status: ReturnType<typeof derivePatientResult>["status"]) {
  return status === "no_warning_detected" ? "var(--green)" : status === "incomplete" ? "var(--yellow)" : "var(--orange)";
}
