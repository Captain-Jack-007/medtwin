"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PharmaSafetyWorkspace } from "@/components/pharma/PharmaSafetyWorkspace";
import { ClinicalMedicationReviewPanel } from "@/components/clinical/ClinicalMedicationReviewPanel";
import { VitalsPanel } from "@/components/VitalsPanel";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/lib/i18n";
import { derivePatientResult } from "@/lib/patient-results";
import { getPharmaScenario } from "@/lib/pharma/scenarios";
import { assessPharmaceuticalRisk } from "@/lib/pharma/risk-engine";
import type { PharmaFinding, PharmaScenario, RiskLevel } from "@/lib/pharma/types";
import type { SynthPatient } from "@/lib/types";

type ClinicalView = "analysis" | "pharma";

const riskTone: Record<RiskLevel, string> = {
  LOW: "var(--green)",
  MODERATE: "var(--yellow)",
  HIGH: "var(--orange)",
  CRITICAL: "var(--red)",
};
const rank: Record<RiskLevel, number> = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };

export function ClinicalWorkspace({ patient }: { patient: SynthPatient }) {
  const { t } = useLanguage();
  const router = useRouter();
  const search = useSearchParams();
  const id = patient.info.id;
  const view: ClinicalView = search.get("view") === "pharma" ? "pharma" : "analysis";
  const scenario = id === "MT-1042" ? getPharmaScenario(id) : null;
  const pharma = scenario ? assessPharmaceuticalRisk(scenario.context) : null;
  const findings = pharma ? allFindings(pharma) : [];

  const go = (next: ClinicalView, finding?: PharmaFinding) => {
    const query = new URLSearchParams({ view: next });
    if (finding) query.set("finding", finding.id);
    router.push(`/clinical/${id}?${query.toString()}`);
  };

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <p className="tick">{t("clinical.title")}</p>
          <h1 className="mono mt-1 text-2xl font-bold tracking-[-0.02em]">{id}</h1>
        </div>
        <Link href={`/twin/${id}`} className="text-sm font-semibold text-[var(--accent)]">
          {t("clinical.patientResults")}
        </Link>
      </header>

      <nav className="mb-6 grid max-w-full grid-cols-2 border border-[var(--border)] p-1" aria-label={t("clinical.title")}>
        {(["analysis", "pharma"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={view === item ? "page" : undefined}
            onClick={() => go(item)}
            className={`min-h-11 px-3 text-xs font-semibold uppercase tracking-[0.07em] transition-colors ${view === item ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
          >
            {item === "analysis" ? t("clinical.analysis") : t("clinical.pharmaceutical")}
          </button>
        ))}
      </nav>

      {view === "analysis" && (
        <ClinicalAnalysis
          patient={patient}
          scenario={scenario}
          pharma={pharma}
          findings={findings}
          onPharma={(finding) => go("pharma", finding)}
        />
      )}
      {view === "pharma" && (scenario ? (
        <PharmaSafetyWorkspace
          patient={patient}
          scenario={scenario}
          onOrganFocus={() => undefined}
        />
      ) : patient.dataMode === "real" ? (
        <ClinicalMedicationReviewPanel patientId={id} />
      ) : null)}
    </main>
  );
}

function ClinicalAnalysis({
  patient,
  scenario,
  pharma,
  findings,
  onPharma,
}: {
  patient: SynthPatient;
  scenario: PharmaScenario | null;
  pharma: ReturnType<typeof assessPharmaceuticalRisk> | null;
  findings: PharmaFinding[];
  onPharma: (finding?: PharmaFinding) => void;
}) {
  const { t } = useLanguage();
  const result = derivePatientResult(patient);
  const primary = findings.slice().sort((a, b) => rank[b.severity] - rank[a.severity]).slice(0, 3);
  const hasClinicalFindings = primary.length > 0 || result.detectedSignalCount > 0;

  return (
    <div className="space-y-5">
      <section className="grid gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        <Stat label={t("clinical.overallRisk")} value={pharma?.overallRisk ?? (result.detectedSignalCount > 0 ? "MODERATE" : "—")} />
        <Stat label={t("patient.criticalFindings")} value={primary.filter((item) => rank[item.severity] >= rank.HIGH).length + result.detectedSignalCount} />
        <Stat label={t("patient.pharmaSignals")} value={pharma?.interactions.length ?? 0} />
        <Stat label={t("patient.affectedSystems")} value={affectedSystems(t, findings, result.affectedSystems)} />
      </section>

      {!hasClinicalFindings ? (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-6">
          <h2 className="text-lg font-semibold">{result.hasSufficientMeasurements ? t("clinical.noFindings") : t("clinical.insufficientData")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            {result.hasSufficientMeasurements ? t("clinical.noFindingsDescription") : t("clinical.insufficientDataDescription")}
          </p>
        </section>
      ) : (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div>
            <h2 className="text-lg font-semibold">{t("clinical.primaryFindings")}</h2>
            <div className="mt-3 space-y-2">
              {primary.map((finding) => (
                <article key={finding.id} className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: riskTone[finding.severity] }}>{finding.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{finding.summary}</p>
                  </div>
                  <button type="button" onClick={() => onPharma(finding)} className="sensor-secondary-button shrink-0 !min-h-8 !px-3 !py-1.5 !text-[11px]">
                    {t("clinical.openPharma")}
                  </button>
                </article>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--bg-elev)] p-5">
            <h2 className="text-lg font-semibold">{t("patient.pharmaTitle")}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{scenario ? t("pharma.description") : t("clinical.noFindingsDescription")}</p>
            {scenario && (
              <button type="button" onClick={() => onPharma()} className="mt-4 text-sm font-semibold text-[var(--accent)]">
                {t("clinical.openPharma")} <Icon name="arrow-right" />
              </button>
            )}
          </div>
        </section>
      )}
      <VitalsPanel session={patient.session} realScan={patient.realScan} variant="workspace" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="min-h-24 bg-[var(--bg-panel)] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p><p className="mono mt-2 text-lg font-bold">{value}</p></div>;
}

function allFindings(pharma: NonNullable<ReturnType<typeof assessPharmaceuticalRisk>>) {
  return [...pharma.interactions, ...pharma.organWarnings, ...pharma.doseConcerns, ...pharma.adverseEventSignals, ...pharma.allergyWarnings];
}

function affectedSystems(t: ReturnType<typeof useLanguage>["t"], findings: PharmaFinding[], systems: readonly string[]) {
  const fromFindings = findings.map((finding) => finding.relatedSystem).filter(Boolean);
  const all = Array.from(new Set([...fromFindings, ...systems]));
  return all.length
    ? all.map((system) => system === "cardiovascular" ? t("pharma.cardiovascular") : system === "renal" ? t("pharma.kidney") : system === "hepatic" ? t("pharma.liver") : system).join(" · ")
    : "—";
}
