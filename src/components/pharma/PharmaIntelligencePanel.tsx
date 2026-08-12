"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assessPharmaceuticalRisk } from "@/lib/pharma/risk-engine";
import { compareTreatmentPlans } from "@/lib/pharma/treatment-delta";
import { simulateTreatment } from "@/lib/pharma/treatment-simulator";
import { buildPharmaTwinState, storePharmaTwinState } from "@/lib/pharma/twin-state";
import type { OrganSystem, PharmaFinding, PharmaScenario, PharmaTwinState, RiskLevel, TreatmentPlan, TreatmentSimulationResult } from "@/lib/pharma/types";
import { PharmaAIPanel } from "./PharmaAIPanel";
import { TreatmentComparison } from "./TreatmentComparison";
import { useLanguage } from "@/lib/i18n";

const tone: Record<RiskLevel, string> = { LOW: "var(--green)", MODERATE: "var(--yellow)", HIGH: "var(--orange)", CRITICAL: "var(--red)" };
const rank: Record<RiskLevel, number> = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };

type Props = { scenario: PharmaScenario; onOrganFocus: (system: OrganSystem) => void; onTwinStateChange?: (state: PharmaTwinState) => void };

export function PharmaIntelligencePanel({ scenario, onOrganFocus, onTwinStateChange }: Props) {
  const { t } = useLanguage();
  const currentPlan = scenario.plans[0];
  const currentResult = useMemo(() => simulateTreatment(scenario.context, currentPlan), [scenario, currentPlan]);
  const findings = useMemo(() => assessPharmaceuticalRisk(scenario.context), [scenario]);
  const allFindings = useMemo(() => [...findings.interactions, ...findings.doseConcerns, ...findings.organWarnings, ...findings.allergyWarnings, ...findings.adverseEventSignals], [findings]);
  const [selectedFinding, setSelectedFinding] = useState<PharmaFinding | null>(() => findings.priorityFinding);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan>(currentPlan);
  const [selectedResult, setSelectedResult] = useState<TreatmentSimulationResult>(currentResult);
  const [selectedOrgan, setSelectedOrgan] = useState<OrganSystem>(findings.priorityFinding?.relatedSystem ?? "renal");
  const [simulating, setSimulating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const simulationTimer = useRef<number | null>(null);
  const activeTwinState = useMemo(() => buildPharmaTwinState(scenario, selectedPlan, selectedResult, selectedPlan.id === currentPlan.id ? "current" : "simulated", selectedOrgan), [currentPlan.id, scenario, selectedOrgan, selectedPlan, selectedResult]);
  const primary = findings.priorityFinding;
  const secondary = allFindings.filter((finding) => finding.id !== primary?.id).sort((a, b) => rank[b.severity] - rank[a.severity])[0] ?? null;
  const delta = useMemo(() => compareTreatmentPlans(currentPlan, selectedPlan, currentResult, selectedResult), [currentPlan, currentResult, selectedPlan, selectedResult]);

  useEffect(() => {
    // A normal Twin entry remains a full-body clinical view. Persist only an
    // explicitly selected alternative, which is an intentional simulation.
    if (activeTwinState.mode === "simulated") storePharmaTwinState(activeTwinState);
    onTwinStateChange?.(activeTwinState);
  }, [activeTwinState, onTwinStateChange]);
  useEffect(() => () => { if (simulationTimer.current) window.clearTimeout(simulationTimer.current); }, []);

  const selectFinding = (finding: PharmaFinding) => {
    setSelectedFinding(finding);
    if (finding.relatedSystem) selectOrgan(finding.relatedSystem);
  };
  const selectOrgan = (system: OrganSystem) => {
    setSelectedOrgan(system);
    onOrganFocus(system);
    // Organ selection is an explicit intent. Persist it separately from the
    // baseline data so the existing Twin can focus the requested anatomy
    // without making ordinary Twin navigation start at a lower-body camera.
    storePharmaTwinState(buildPharmaTwinState(scenario, selectedPlan, selectedResult, selectedPlan.id === currentPlan.id ? "current" : "simulated", system));
    const organFinding = allFindings.filter((finding) => finding.relatedSystem === system).sort((a, b) => rank[b.severity] - rank[a.severity])[0];
    if (organFinding) setSelectedFinding(organFinding);
  };
  const selectPlan = (plan: TreatmentPlan, result: TreatmentSimulationResult) => {
    if (simulationTimer.current) window.clearTimeout(simulationTimer.current);
    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setSelectedPlan(plan);
    setSelectedResult(result);
    const nextOrgan: OrganSystem = result.renalRisk !== "LOW" ? "renal" : result.hepaticRisk !== "LOW" ? "hepatic" : "cardiovascular";
    setSelectedOrgan(nextOrgan);
    onOrganFocus(nextOrgan);
    if (plan.id !== currentPlan.id && !reducedMotion) {
      setSimulating(true);
      simulationTimer.current = window.setTimeout(() => setSimulating(false), 1250);
    } else setSimulating(false);
  };
  const returnCurrent = () => selectPlan(currentPlan, currentResult);

  return <section className="pb-2"><header className="border-b border-[var(--border)] pb-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-lg font-bold tracking-[-0.015em]">{t("pharma.title")}</h1><p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--muted)]">{t("pharma.description")}</p></div><span className="rounded-full border border-[var(--yellow)]/60 px-2.5 py-1 text-[10px] font-semibold text-[var(--yellow)]">{t("pharma.environment")}</span></div></header>
    <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">{[[t("pharma.currentMedications"), scenario.context.medications.length], [t("pharma.criticalInteractions"), findings.interactions.filter((item) => rank[item.severity] >= rank.HIGH).length], [t("pharma.adverseRisk"), findings.overallRisk], [t("pharma.doseConcerns"), findings.doseConcerns.length]].map(([label, value]) => <div key={String(label)} className="bg-[var(--bg-panel)] p-3"><p className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p><p className="mono mt-1 text-xl font-bold" style={{ color: typeof value === "string" ? tone[value as RiskLevel] : undefined }}>{riskLabel(t, value as string | number)}</p></div>)}</div>
    <IntelligenceSummary primary={primary} secondary={secondary} onSelect={selectFinding} onCompare={() => document.getElementById("treatment-comparison")?.scrollIntoView({ behavior: "smooth", block: "start" })} />
    <section className="mt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="tick">{t("pharma.organRisk")}</h2>{selectedPlan.id !== currentPlan.id && <button type="button" onClick={returnCurrent} className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-2)]">{t("pharma.returnCurrent")}</button>}</div><div className="mt-2 grid gap-2 sm:grid-cols-3">{(["renal", "hepatic", "cardiovascular"] as const).map((system) => { const level = selectedResult[`${system}Risk` as "renalRisk" | "hepaticRisk" | "cardiovascularRisk"]; const selected = selectedOrgan === system; return <button type="button" key={system} aria-pressed={selected} onClick={() => selectOrgan(system)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${selected ? "border-[var(--accent)] bg-[var(--accent)]/[0.08]" : "border-[var(--border)] bg-white/[0.018] hover:border-[var(--muted)]"}`}><span className="text-xs text-[var(--muted)]">{organLabel(t, system)}</span><span className="mono text-xs font-bold" style={{ color: tone[level] }}>{riskLabel(t, level)}</span></button>; })}</div><p className="mt-2 text-[11px] text-[var(--muted)]">{selectedPlan.id === currentPlan.id ? t("pharma.currentTwinState") : t("pharma.simulatedTwinFor", { plan: planLabel(t, selectedPlan.id) })}</p></section>
    <section className="mt-5"><div className="flex items-center justify-between"><h2 className="tick">{t("pharma.currentMedications")}</h2><span className="text-[10px] text-[var(--muted)]">{t("pharma.syntheticProfile")}</span></div><div className="mt-3 space-y-2">{scenario.context.medications.map((medication) => { const medicationFindings = allFindings.filter((finding) => finding.medicationIds.includes(medication.id)); const severity = medicationFindings.sort((left, right) => rank[right.severity] - rank[left.severity])[0]?.severity ?? "LOW"; return <article key={medication.id} className="rounded-xl border border-[var(--border)] bg-white/[0.018] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{medication.genericName}</h3><p className="mt-0.5 text-xs text-[var(--muted)]">{medication.category} · {medication.dose} · {medication.frequency}</p></div><span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ color: tone[severity], backgroundColor: `color-mix(in srgb, ${tone[severity]} 13%, transparent)` }}>{riskLabel(t, severity)} {t("pharma.signal")}</span></div>{medicationFindings[0] && <button type="button" onClick={() => selectFinding(medicationFindings[0])} className="mt-3 block text-left text-xs leading-relaxed text-[var(--text)] hover:text-[var(--accent)]"><span className="font-semibold">{t("pharma.detectedSignal")} </span>{medicationFindings[0].summary}</button>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => medicationFindings[0] && selectFinding(medicationFindings[0])} className="sensor-secondary-button !min-h-8 !px-3 !py-1.5 !text-xs">{t("pharma.explainRisk")}</button><button type="button" onClick={() => dialogRef.current?.showModal()} className="sensor-secondary-button !min-h-8 !px-3 !py-1.5 !text-xs">{t("pharma.simulateChange")}</button></div></article>; })}</div></section>
    {selectedFinding && <FindingDetail finding={selectedFinding} onFocus={() => selectedFinding.relatedSystem && selectOrgan(selectedFinding.relatedSystem)} />}
    <div id="treatment-comparison"><TreatmentComparison scenario={scenario} selectedPlanId={selectedPlan.id} isSimulating={simulating} onSelect={selectPlan} onExplain={(plan, result) => { selectPlan(plan, result); window.requestAnimationFrame(() => document.getElementById("pharma-ai")?.scrollIntoView({ behavior: "smooth", block: "center" })); }} /></div>
    <SimulationTimeline active={selectedPlan.id !== currentPlan.id} delta={delta} currentScore={currentResult.overallRiskScore} selectedScore={selectedResult.overallRiskScore} />
    <p className="mt-5 text-[11px] leading-relaxed text-[var(--muted)]">{t("pharma.disclaimer")}</p>
    <PharmaAIPanel scenario={scenario} finding={selectedFinding} currentPlan={currentPlan} selectedPlan={selectedPlan} selectedSimulation={selectedResult} />
    <dialog ref={dialogRef} className="m-auto w-[min(94vw,550px)] rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-0 text-[var(--text)] backdrop:bg-black/70"><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{t("pharma.dialogTitle")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("pharma.dialogDescription")}</p></div><button type="button" onClick={() => dialogRef.current?.close()} aria-label={t("pharma.dialogClose")} className="text-lg text-[var(--muted)] hover:text-[var(--text)]">×</button></div><p className="mt-4 text-sm">{t("pharma.dialogChoose")}</p><div className="mt-4 space-y-2">{scenario.plans.slice(1).map((plan) => <button key={plan.id} type="button" onClick={() => { selectPlan(plan, simulateTreatment(scenario.context, plan)); dialogRef.current?.close(); }} className="w-full rounded-lg border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--accent)]"><span className="font-semibold">{planLabel(t, plan.id)}</span><span className="mt-1 block text-xs text-[var(--muted)]">{plan.interventions.join(" · ")}</span></button>)}</div><p className="mt-4 text-[11px] text-[var(--muted)]">{t("pharma.noRealChange")}</p></div></dialog>
  </section>;
}

function IntelligenceSummary({ primary, secondary, onSelect, onCompare }: { primary: PharmaFinding | null; secondary: PharmaFinding | null; onSelect: (finding: PharmaFinding) => void; onCompare: () => void }) { const { t } = useLanguage(); const card = (finding: PharmaFinding, kind: "primary" | "secondary") => <button type="button" onClick={() => onSelect(finding)} className="w-full rounded-lg border border-[var(--border)] bg-black/15 p-3 text-left transition-colors hover:border-[var(--accent)]"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{kind === "primary" ? t("pharma.primarySignal") : t("pharma.secondarySignal")}</p><p className="mt-1 font-semibold" style={{ color: tone[finding.severity] }}>{finding.title}</p><p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{finding.summary}</p><div className="mt-3 flex flex-wrap gap-1.5">{finding.relatedSystem && <span className="rounded-full border border-[var(--border)] px-2 py-1 text-[10px]">{organLabel(t, finding.relatedSystem)}</span>}<span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: tone[finding.severity] }}>{riskLabel(t, finding.severity)}</span></div></button>; return <section className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3"><div><h2 className="tick">{t("pharma.intelligenceSummary")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("pharma.criticalSignals", { count: [primary, secondary].filter((item) => item && rank[item.severity] >= rank.HIGH).length })}</p></div><button type="button" onClick={onCompare} className="sensor-secondary-button !min-h-8 !px-3 !py-1.5 !text-xs">{t("pharma.simulateAlternatives")}</button></div>{primary && <div className="grid gap-3 p-3 md:grid-cols-2">{card(primary, "primary")}{secondary ? card(secondary, "secondary") : <div className="rounded-lg bg-black/10 p-3 text-xs text-[var(--muted)]">{t("pharma.noSecondarySignal")}</div>}</div>}</section>; }
function FindingDetail({ finding, onFocus }: { finding: PharmaFinding; onFocus: () => void }) { const { t } = useLanguage(); return <section className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="tick">{t("pharma.whySignal")}</p><h2 className="mt-1 text-base font-semibold" style={{ color: tone[finding.severity] }}>{finding.title}</h2></div><span className="mono text-xs font-bold" style={{ color: tone[finding.severity] }}>{riskLabel(t, finding.severity)}</span></div><p className="mt-2 text-sm leading-relaxed">{finding.summary}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">{finding.medicationIds.map((item) => <span key={item} className="rounded-full border border-[var(--border)] px-2 py-1">{item}</span>)}<span aria-hidden>↓</span><span>{t("pharma.ruleTriggered")}</span></div>{finding.relatedSystem && <button type="button" onClick={onFocus} className="mt-3 text-xs font-semibold text-[var(--accent)]">{t("pharma.focus", { organ: organLabel(t, finding.relatedSystem) })}</button>}</section>; }
function SimulationTimeline({ active, delta, currentScore, selectedScore }: { active: boolean; delta: ReturnType<typeof compareTreatmentPlans>; currentScore: number; selectedScore: number }) { const { t } = useLanguage(); const events = active ? [["14:02", "pharma.eventLoaded", "var(--accent)"], ["14:06", "pharma.eventDetected", "var(--red)"], ["14:08", "pharma.eventStarted", "var(--accent)"], ["14:09", "pharma.eventInteractions", "var(--green)"], ["14:09", "pharma.eventRenal", "var(--green)"], ["14:10", "pharma.eventTwinUpdated", "var(--accent)"]] : [["14:02", "pharma.eventLoaded", "var(--accent)"], ["14:06", "pharma.eventDetected", "var(--red)"]]; return <section className="mt-5 border-t border-[var(--border)] pt-4"><h2 className="tick">{t("pharma.timeline")}</h2><ol className="mt-3 space-y-2 text-xs">{events.map(([time, key, color]) => <li key={key} className="flex gap-3"><span className="mono" style={{ color }}>{time}</span><span>{key === "pharma.eventInteractions" ? t(key as "pharma.eventInteractions", { before: delta.riskChanges.find((item) => item.key === "interactionCount")?.before ?? 0, after: delta.riskChanges.find((item) => item.key === "interactionCount")?.after ?? 0 }) : key === "pharma.eventRenal" ? t(key as "pharma.eventRenal", { before: riskLabel(t, delta.organRiskChanges.find((item) => item.system === "renal")?.before ?? "LOW"), after: riskLabel(t, delta.organRiskChanges.find((item) => item.system === "renal")?.after ?? "LOW") }) : key === "pharma.eventTwinUpdated" ? t(key as "pharma.eventTwinUpdated", { before: currentScore, after: selectedScore }) : t(key as "pharma.eventLoaded" | "pharma.eventDetected" | "pharma.eventStarted")}</span></li>)}</ol></section>; }
function riskLabel(t: ReturnType<typeof useLanguage>["t"], risk: string | number) { if (typeof risk === "number") return String(risk); const keys: Record<string, "pharma.risk.LOW" | "pharma.risk.MODERATE" | "pharma.risk.HIGH" | "pharma.risk.CRITICAL"> = { LOW: "pharma.risk.LOW", MODERATE: "pharma.risk.MODERATE", HIGH: "pharma.risk.HIGH", CRITICAL: "pharma.risk.CRITICAL" }; return t(keys[risk] ?? "pharma.risk.LOW"); }
function organLabel(t: ReturnType<typeof useLanguage>["t"], system: OrganSystem) { return system === "renal" ? t("pharma.kidney") : system === "hepatic" ? t("pharma.liver") : t("pharma.cardiovascular"); }
function planLabel(t: ReturnType<typeof useLanguage>["t"], id: string) { return id === "current" ? t("pharma.currentPlan") : id === "alternative-a" ? t("pharma.alternativePlan", { letter: "A" }) : t("pharma.alternativePlan", { letter: "B" }); }
