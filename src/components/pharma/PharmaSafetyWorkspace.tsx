"use client";

import { useMemo, useState } from "react";
import { DigitalTwinBody } from "@/components/anatomy/DigitalTwinBody";
import { useLanguage } from "@/lib/i18n";
import { assessMedicineCandidates } from "@/lib/pharma/medicine-assessment";
import { buildPharmaTwinState } from "@/lib/pharma/twin-state";
import type { MedicineAssessment, MedicineImpactOrgan, MedicationSafetyStatus, OrganSystem, PharmaScenario, PharmaTwinState, RiskLevel } from "@/lib/pharma/types";
import type { SynthPatient } from "@/lib/types";
import { PharmaAIPanel } from "./PharmaAIPanel";

const statusTone: Record<MedicationSafetyStatus, string> = {
  safe: "var(--green)",
  not_recommended: "var(--muted)",
  high_risk: "var(--red)",
};
const impactTone = { positive: "var(--green)", neutral: "var(--muted)", moderate: "var(--yellow)", negative: "var(--orange)", critical: "var(--red)" } as const;
const riskTone: Record<RiskLevel, string> = { LOW: "var(--green)", MODERATE: "var(--yellow)", HIGH: "var(--orange)", CRITICAL: "var(--red)" };

type Props = {
  patient: SynthPatient;
  scenario: PharmaScenario;
  onOrganFocus: (organ: OrganSystem) => void;
  onTwinStateChange?: (state: PharmaTwinState) => void;
};

export function PharmaSafetyWorkspace({ patient, scenario, onOrganFocus, onTwinStateChange }: Props) {
  const { t } = useLanguage();
  const assessments = useMemo(() => assessMedicineCandidates(scenario), [scenario]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(() => assessments[0]?.medicineId ?? "");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const selected = assessments.find((assessment) => assessment.medicineId === selectedId) ?? assessments[0] ?? null;
  const visible = assessments.filter((assessment) => {
    const medicine = scenario.medicineCandidates?.find((candidate) => candidate.id === assessment.medicineId)?.medication;
    return !query.trim() || medicine?.genericName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  const profile = scenario.patientProfile;
  const bodyRisks = selected ? {
    renal: selected.simulation.renalRisk,
    hepatic: selected.simulation.hepaticRisk,
    cardiovascular: selected.simulation.cardiovascularRisk,
  } : undefined;

  const select = (assessment: MedicineAssessment) => {
    setSelectedId(assessment.medicineId);
    const organ = primaryOrgan(assessment);
    const state = buildPharmaTwinState(scenario, assessment.simulatedPlan, assessment.simulation, "simulated", organ);
    onTwinStateChange?.(state);
  };
  const focus = (organ: OrganSystem) => {
    if (!selected) return;
    onTwinStateChange?.(buildPharmaTwinState(scenario, selected.simulatedPlan, selected.simulation, "simulated", organ));
    onOrganFocus(organ);
  };
  const toggleComparison = (id: string) => setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : [...current.slice(1), id]);
  const selectedForComparison = assessments.filter((assessment) => compareIds.includes(assessment.medicineId));

  return <section className="pb-2" aria-label={t("pharma.safetyWorkspace")}> 
    <header className="border-b border-[var(--border)] pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="tick">{t("pharma.environment")}</p><h1 className="mt-1 text-xl font-bold tracking-[-0.015em]">{t("pharma.safetyWorkspace")}</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-[var(--muted)]">{t("pharma.safetyDescription")}</p><p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-[var(--muted)]">{t("pharma.catalogNotice")}</p></div><span className="hidden rounded-full border border-[var(--yellow)]/60 px-2.5 py-1 text-[10px] font-semibold text-[var(--yellow)] sm:inline-flex">{t("pharma.environment")}</span></div>
    </header>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(320px,0.6fr)_minmax(0,1fr)]">
      <aside className="min-w-0 border border-[var(--border)] bg-[var(--bg-panel)]">
        <div className="border-b border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="mono text-lg font-bold">{patient.info.id}</p><p className="mt-1 text-xs text-[var(--muted)]">{t("pharma.syntheticPatientProfile")}</p></div><span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">{t("pharma.currentState")}</span></div><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm"><Data label={t("pharma.age")} value={t("pharma.years", { count: profile?.age ?? scenario.context.age })} /><Data label={t("pharma.sex")} value={patient.info.sex === "M" ? t("pharma.male") : t("pharma.female")} /><Data label={t("pharma.height")} value={`${profile?.heightCm ?? "—"} ${t("pharma.cm")}`} /><Data label={t("pharma.weight")} value={`${profile?.weightKg ?? "—"} ${t("pharma.kg")}`} /></div>{profile && <Data label={t("pharma.bmi")} value={(profile.weightKg / ((profile.heightCm / 100) ** 2)).toFixed(1)} className="mt-3" />}</div>
        <div className="border-b border-[var(--border)] p-4"><h2 className="tick">{t("pharma.conditions")}</h2><ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">{(profile?.conditions ?? scenario.context.syntheticConditions).map((condition) => <li key={condition} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />{conditionLabel(t, condition)}</li>)}</ul></div>
        <div className="relative min-h-[265px] border-b border-[var(--border)] bg-[radial-gradient(circle_at_50%_40%,rgba(45,212,191,0.1),transparent_55%)]"><DigitalTwinBody states={patient.triage.systemStates} focus={focusTarget(primaryOrgan(selected))} presentation pharmaOrganRisks={bodyRisks} /><span className="absolute bottom-3 left-3 rounded-full border border-[var(--border)] bg-[var(--bg)]/80 px-2 py-1 text-[10px] text-[var(--muted)]">{selected ? t("pharma.candidateSimulation") : t("pharma.currentState")}</span></div>
        <div className="p-4"><h2 className="tick">{t("pharma.organOverview")}</h2><div className="mt-3 grid grid-cols-2 gap-2"><OrganButton label={t("pharma.kidney")} detail={profile?.kidneyEstimate ?? "—"} risk={selected?.simulation.renalRisk ?? scenario.context.kidneyStatus} onClick={() => focus("renal")} /><OrganButton label={t("pharma.liver")} detail={t("pharma.normal")} risk={selected?.simulation.hepaticRisk ?? scenario.context.liverStatus} onClick={() => focus("hepatic")} /><OrganButton label={t("pharma.cardiovascular")} detail={profile?.cardiovascularSummary ?? "—"} risk={selected?.simulation.cardiovascularRisk ?? "LOW"} onClick={() => focus("cardiovascular")} /><OrganButton label={t("pharma.bleeding")} detail={t("pharma.riskSignal")} risk={selected?.simulation.bleedingRisk ?? profile?.bleedingRisk ?? "LOW"} /></div></div>
        <div className="border-t border-[var(--border)] p-4"><h2 className="tick">{t("pharma.patientRisk")}</h2><p className="mono mt-2 text-lg font-bold" style={{ color: riskTone[scenario.context.kidneyStatus] }}>{riskLabel(t, scenario.context.kidneyStatus)}</p><p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{t("pharma.patientRiskSummary")}</p></div>
      </aside>
      <div className="min-w-0"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-3"><div><h2 className="text-lg font-bold">{t("pharma.medicineSafety")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("pharma.medicineSafetyDescription")}</p></div><div className="flex flex-wrap gap-3 text-[11px] text-[var(--muted)]"><Legend color="var(--green)" label={t("pharma.status.safe")} /><Legend color="var(--muted)" label={t("pharma.status.notRecommended")} /><Legend color="var(--red)" label={t("pharma.status.highRisk")} /></div></div>
        <label className="mt-4 block"><span className="sr-only">{t("pharma.search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("pharma.search")} className="h-10 w-full border border-[var(--border)] bg-black/15 px-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]" /></label>
        <div className="mt-3 space-y-2">{visible.map((assessment) => <MedicineCard key={assessment.medicineId} scenario={scenario} assessment={assessment} active={selected?.medicineId === assessment.medicineId} compared={compareIds.includes(assessment.medicineId)} onSelect={() => select(assessment)} onCompare={() => toggleComparison(assessment.medicineId)} />)}</div>
        {visible.length === 0 && <p className="border border-[var(--border)] p-4 text-sm text-[var(--muted)]">{t("pharma.noCandidate")}</p>}
        {selected && <section className="mt-4 border border-[var(--border)] bg-[var(--bg-elev)] p-4" aria-live="polite"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="tick">{t("pharma.selectedMedicine")}</p><h3 className="mt-1 text-base font-semibold">{medicineName(scenario, selected)}</h3></div><SafetyBadge status={selected.safetyStatus} recommended={selected.isRecommended} /></div><p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{selected.overallSummary}</p><ImpactGrid assessment={selected} /><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => document.getElementById("pharma-ai")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="sensor-primary-button !min-h-9 !px-3 !py-2 !text-xs">{t("pharma.aiExplain")}</button><button type="button" onClick={() => toggleComparison(selected.medicineId)} className="sensor-secondary-button !min-h-9 !px-3 !py-2 !text-xs">{t("pharma.compareMedicines")}</button></div></section>}
        {selectedForComparison.length >= 2 && <Comparison scenario={scenario} assessments={selectedForComparison} onClose={() => setCompareIds([])} />}
        {selected && <PharmaAIPanel scenario={scenario} finding={null} currentPlan={scenario.plans[0]} selectedPlan={selected.simulatedPlan} selectedSimulation={selected.simulation} candidateId={selected.medicineId} audience="clinician" />}
      </div>
    </div>
    <p className="mt-5 text-[11px] leading-relaxed text-[var(--muted)]">{t("pharma.safetyDisclaimer")}</p>
  </section>;
}

function MedicineCard({ scenario, assessment, active, compared, onSelect, onCompare }: { scenario: PharmaScenario; assessment: MedicineAssessment; active: boolean; compared: boolean; onSelect: () => void; onCompare: () => void }) { const { t } = useLanguage(); const candidate = scenario.medicineCandidates?.find((item) => item.id === assessment.medicineId); if (!candidate) return null; return <article className={`border p-3 transition-colors duration-200 ${active ? "border-[var(--accent)] bg-[var(--accent)]/[0.07]" : "border-[var(--border)] bg-white/[0.018] hover:border-[var(--muted)]"}`}><button type="button" onClick={onSelect} aria-pressed={active} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{candidate.medication.genericName} <span className="text-[var(--muted)]">{candidate.medication.dose}</span></h3><p className="mt-0.5 text-xs text-[var(--muted)]">{categoryLabel(t, candidate.medication.category)} · {candidate.medication.frequency}</p></div><SafetyBadge status={assessment.safetyStatus} recommended={assessment.isRecommended} /></div><p className="mt-2 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">{assessment.overallSummary}</p></button><ImpactGrid assessment={assessment} compact /><div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3"><span className="mono text-xs font-bold" style={{ color: statusTone[assessment.safetyStatus] }}>{assessment.safetyScore}/100</span><button type="button" onClick={onCompare} className={`text-xs font-semibold ${compared ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>{compared ? t("pharma.addedCompare") : t("pharma.addCompare")}</button></div></article>; }
function ImpactGrid({ assessment, compact = false }: { assessment: MedicineAssessment; compact?: boolean }) { const { t } = useLanguage(); return <div className={`mt-3 grid gap-px overflow-hidden border border-[var(--border)] bg-[var(--border)] ${compact ? "grid-cols-4" : "sm:grid-cols-4"}`}>{assessment.patientImpacts.map((impact) => <div key={impact.organ} className="min-w-0 bg-black/15 p-2"><p className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">{impactLabel(t, impact.organ)}</p><p className="mt-1 truncate text-[11px] font-semibold" style={{ color: impactTone[impact.severity] }}>{impactLabel(t, impact.organ === "overall" ? "overall" : impact.severity)}</p>{!compact && <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{impact.explanation}</p>}</div>)}</div>; }
function Comparison({ scenario, assessments, onClose }: { scenario: PharmaScenario; assessments: MedicineAssessment[]; onClose: () => void }) { const { t } = useLanguage(); return <section className="mt-4 overflow-x-auto border border-[var(--border)] bg-[var(--bg-panel)]"><header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3"><div><h3 className="text-sm font-semibold">{t("pharma.comparison")}</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">{t("pharma.decisionSupport")}</p></div><button type="button" onClick={onClose} className="min-h-11 shrink-0 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">{t("pharma.closeComparison")}</button></header><div className="min-w-[560px] divide-y divide-[var(--border)]"><div className="grid grid-cols-[120px_repeat(3,minmax(120px,1fr))] gap-px bg-[var(--border)]"><span className="bg-[var(--bg-panel)] p-3" />{assessments.map((assessment) => <span key={assessment.medicineId} className="bg-[var(--bg-panel)] p-3 text-sm font-semibold">{medicineName(scenario, assessment)}</span>)}</div>{(["safety", "renal", "bleeding", "cardiovascular", "score"] as const).map((row) => <div key={row} className="grid grid-cols-[120px_repeat(3,minmax(120px,1fr))] gap-px bg-[var(--border)]"><span className="bg-black/15 p-3 text-xs text-[var(--muted)]">{comparisonLabel(t, row)}</span>{assessments.map((assessment) => <span key={assessment.medicineId} className="bg-[var(--bg-panel)] p-3 text-xs font-semibold" style={{ color: row === "safety" ? statusTone[assessment.safetyStatus] : undefined }}>{comparisonValue(t, assessment, row)}</span>)}</div>)}</div></section>; }
function OrganButton({ label, detail, risk, onClick }: { label: string; detail: string; risk: RiskLevel; onClick?: () => void }) { return <button type="button" disabled={!onClick} onClick={onClick} className="border border-[var(--border)] bg-black/10 p-2 text-left enabled:hover:border-[var(--accent)] disabled:cursor-default"><p className="text-[10px] text-[var(--muted)]">{label}</p><p className="mt-1 text-xs font-semibold" style={{ color: riskTone[risk] }}>{risk}</p><p className="mt-0.5 text-[10px] text-[var(--muted)]">{detail}</p></button>; }
function Data({ label, value, className = "" }: { label: string; value: string; className?: string }) { return <div className={className}><p className="text-[10px] text-[var(--muted)]">{label}</p><p className="mt-0.5 font-medium">{value}</p></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>; }
function SafetyBadge({ status, recommended }: { status: MedicationSafetyStatus; recommended: boolean }) { const { t } = useLanguage(); return <div className="flex flex-wrap justify-end gap-1"><span className="rounded-full px-2 py-1 text-[9px] font-bold tracking-[0.05em]" style={{ color: statusTone[status], backgroundColor: `color-mix(in srgb, ${statusTone[status]} 14%, transparent)` }}>{statusLabel(t, status)}</span>{recommended && <span className="rounded-full bg-[var(--green)]/15 px-2 py-1 text-[9px] font-bold tracking-[0.05em] text-[var(--green)]">★ {t("pharma.recommended")}</span>}</div>; }
function primaryOrgan(assessment: MedicineAssessment | null): OrganSystem { const impact = assessment?.patientImpacts.find((item) => item.organ === "renal" && (item.severity === "critical" || item.severity === "negative")) ?? assessment?.patientImpacts.find((item) => item.organ === "cardiovascular") ?? assessment?.patientImpacts[0]; return impact?.organ === "hepatic" ? "hepatic" : impact?.organ === "cardiovascular" || impact?.organ === "bleeding" ? "cardiovascular" : "renal"; }
function focusTarget(organ: OrganSystem) { return organ === "renal" ? "renal" : organ === "hepatic" ? "hepatic" : "cardiovascular"; }
function medicineName(scenario: PharmaScenario, assessment: MedicineAssessment) { return scenario.medicineCandidates?.find((item) => item.id === assessment.medicineId)?.medication.genericName ?? assessment.medicineId; }
function statusLabel(t: ReturnType<typeof useLanguage>["t"], status: MedicationSafetyStatus) { return status === "safe" ? t("pharma.status.safe") : status === "not_recommended" ? t("pharma.status.notRecommended") : t("pharma.status.highRisk"); }
function riskLabel(t: ReturnType<typeof useLanguage>["t"], risk: RiskLevel) { return t(`pharma.risk.${risk}` as "pharma.risk.LOW"); }
function impactLabel(t: ReturnType<typeof useLanguage>["t"], value: MedicineImpactOrgan | keyof typeof impactTone) { const labels = { renal: t("pharma.kidney"), hepatic: t("pharma.liver"), cardiovascular: t("pharma.cardiovascular"), bleeding: t("pharma.bleeding"), overall: t("pharma.overall"), positive: t("pharma.impact.positive"), neutral: t("pharma.impact.neutral"), moderate: t("pharma.impact.moderate"), negative: t("pharma.impact.negative"), critical: t("pharma.impact.critical") }; return labels[value]; }
function categoryLabel(t: ReturnType<typeof useLanguage>["t"], category: string) { return ({ Anticoagulant: t("pharma.category.anticoagulant"), "Antiplatelet agent": t("pharma.category.antiplatelet"), NSAID: t("pharma.category.nsaid"), Analgesic: t("pharma.category.analgesic"), "Cardiovascular agent": t("pharma.category.cardiovascular"), "Lipid-lowering agent": t("pharma.category.lipid"), "Metabolic agent": t("pharma.category.metabolic"), Diuretic: t("pharma.category.diuretic"), "Gastroprotective agent": t("pharma.category.gastroprotective") }[category] ?? category); }
function conditionLabel(t: ReturnType<typeof useLanguage>["t"], condition: string) { return ({ atrial_fibrillation: t("pharma.condition.af"), ckd_stage_3a: t("pharma.condition.ckd"), hypertension: t("pharma.condition.hypertension"), osteoarthritis: t("pharma.condition.osteoarthritis") }[condition] ?? condition); }
function comparisonLabel(t: ReturnType<typeof useLanguage>["t"], row: "safety" | "renal" | "bleeding" | "cardiovascular" | "score") { return ({ safety: t("pharma.safety"), renal: t("pharma.kidney"), bleeding: t("pharma.bleeding"), cardiovascular: t("pharma.cardiovascular"), score: t("pharma.riskScore") })[row]; }
function comparisonValue(t: ReturnType<typeof useLanguage>["t"], assessment: MedicineAssessment, row: "safety" | "renal" | "bleeding" | "cardiovascular" | "score") { if (row === "safety") return statusLabel(t, assessment.safetyStatus); if (row === "score") return `${assessment.safetyScore}/100`; const key = row === "renal" ? "renal" : row === "bleeding" ? "bleeding" : "cardiovascular"; return assessment.patientImpacts.find((impact) => impact.organ === key)?.severity ? impactLabel(t, assessment.patientImpacts.find((impact) => impact.organ === key)!.severity) : "—"; }
