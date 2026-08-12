"use client";

import { useEffect, useMemo, useState } from "react";
import { compareTreatmentPlans } from "@/lib/pharma/treatment-delta";
import { simulateScenario } from "@/lib/pharma/treatment-simulator";
import type { PharmaScenario, RiskLevel, TreatmentPlan, TreatmentSimulationResult } from "@/lib/pharma/types";
import { useLanguage } from "@/lib/i18n";

const riskTone: Record<RiskLevel, string> = { LOW: "var(--green)", MODERATE: "var(--yellow)", HIGH: "var(--orange)", CRITICAL: "var(--red)" };
const scoreTone = (score: number) => score >= 60 ? "var(--red)" : score >= 35 ? "var(--yellow)" : "var(--green)";

type Props = {
  scenario: PharmaScenario;
  selectedPlanId: string;
  isSimulating?: boolean;
  onSelect: (plan: TreatmentPlan, result: TreatmentSimulationResult) => void;
  onExplain: (plan: TreatmentPlan, result: TreatmentSimulationResult) => void;
};

export function TreatmentComparison({ scenario, selectedPlanId, isSimulating = false, onSelect, onExplain }: Props) {
  const { t } = useLanguage();
  const simulations = useMemo(() => simulateScenario(scenario), [scenario]);
  const current = simulations[0];
  const selected = simulations.find((item) => item.plan.id === selectedPlanId) ?? current;
  const best = [...simulations].sort((left, right) => left.result.overallRiskScore - right.result.overallRiskScore)[0]?.plan.id;
  const delta = useMemo(() => compareTreatmentPlans(current.plan, selected.plan, current.result, selected.result), [current, selected]);
  const [visualScore, setVisualScore] = useState(selected.result.overallRiskScore);

  useEffect(() => {
    const target = selected.result.overallRiskScore;
    if (!isSimulating || selected.plan.id === current.plan.id || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setVisualScore(target));
      return () => cancelAnimationFrame(frame);
    }
    const startedAt = performance.now();
    const from = current.result.overallRiskScore;
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1200);
      const eased = 1 - Math.pow(1 - progress, 4);
      setVisualScore(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [current.result.overallRiskScore, current.plan.id, isSimulating, selected.plan.id, selected.result.overallRiskScore]);

  return <section className="mt-6 border-t border-[var(--border)] pt-5" aria-label={t("pharma.comparison")}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="tick">{t("pharma.comparison")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("pharma.decisionSupport")}</p></div><span className="text-[10px] text-[var(--muted)]">{t("pharma.scoresSimulated")}</span></div>
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{simulations.map(({ plan, result }, index) => {
      const active = plan.id === selected.plan.id;
      const isCurrent = index === 0;
      const planDelta = !isCurrent ? compareTreatmentPlans(current.plan, plan, current.result, result) : null;
      const largestImpact = planDelta?.riskChanges.find((item) => item.direction === "down" && (item.key === "bleedingRisk" || item.key === "renalRisk")) ?? planDelta?.riskChanges.find((item) => item.direction !== "unchanged");
      return <article key={plan.id} className={`relative overflow-hidden rounded-xl border p-4 transition-colors duration-200 ${active ? "border-[var(--accent)] bg-[var(--accent)]/[0.07]" : "border-[var(--border)] bg-white/[0.018]"}`}>
        {plan.id === best && <span className="absolute right-3 top-3 rounded-full bg-[var(--green)]/15 px-2 py-1 text-[9px] font-bold tracking-[0.06em] text-[var(--green)]">{t("pharma.bestOutcome")}</span>}
        <button type="button" aria-pressed={active} onClick={() => onSelect(plan, result)} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-2)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{isCurrent ? t("pharma.currentPlan") : t("pharma.alternative", { letter: index === 1 ? "A" : "B" })}</p>
          <h3 className="mt-2 min-h-10 pr-20 text-sm font-semibold">{planLabel(t, index)}</h3>
          <div className="mt-4 flex items-end gap-2"><span className="mono text-4xl font-bold" style={{ color: scoreTone(result.overallRiskScore) }}>{active ? visualScore : result.overallRiskScore}</span><span className="mb-1 text-xs text-[var(--muted)]">/ 100</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${active ? visualScore : result.overallRiskScore}%`, backgroundColor: scoreTone(result.overallRiskScore) }} /></div>
          <p className="mt-2 text-xs font-semibold" style={{ color: scoreTone(result.overallRiskScore) }}>{isCurrent ? t("pharma.currentState") : result.overallRiskScore >= 60 ? t("pharma.highRisk") : result.overallRiskScore >= 35 ? t("pharma.moderateRisk") : t("pharma.lowerRisk")}</p>
        </button>
        {!isCurrent && planDelta && <div className="mt-4 border-t border-[var(--border)] pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{t("pharma.keyChange")}</p><p className="mt-1 text-xs leading-relaxed text-[var(--text)]">{planDelta.medicationsRemoved.length ? t("pharma.medicinesRemoved", { count: planDelta.medicationsRemoved.length }) : t("pharma.noMedicationChange")}</p>{largestImpact && <p className="mt-2 text-[11px] text-[var(--accent)]">{t("pharma.largestImpact")}: {metricLabel(t, largestImpact.key)} {formatValue(largestImpact.before)} → {formatValue(largestImpact.after)}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onSelect(plan, result)} className="sensor-secondary-button !min-h-8 !px-3 !py-1.5 !text-[11px]">{t("pharma.simulateOnTwin")}</button><button type="button" onClick={() => onExplain(plan, result)} className="text-[11px] font-semibold text-[var(--accent)] hover:text-[var(--accent-2)]">{t("pharma.whyChanged")}</button></div></div>}
      </article>;
    })}</div>
    {selected.plan.id !== current.plan.id && <SimulationImpact current={current.result} alternative={selected.result} delta={delta} running={isSimulating} />}
  </section>;
}

function SimulationImpact({ current, alternative, delta, running }: { current: TreatmentSimulationResult; alternative: TreatmentSimulationResult; delta: ReturnType<typeof compareTreatmentPlans>; running: boolean }) {
  const { t } = useLanguage();
  const rows = [
    [t("pharma.riskScore"), current.overallRiskScore, alternative.overallRiskScore, "score"],
    [t("pharma.bleeding"), current.bleedingRisk, alternative.bleedingRisk, "risk"],
    [t("pharma.renalBurden"), current.renalRisk, alternative.renalRisk, "risk"],
    [t("pharma.interactions"), current.interactionCount, alternative.interactionCount, "count"],
    [t("pharma.stability"), current.stabilityScore, alternative.stabilityScore, "score"],
  ] as const;
  return <section className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]" aria-live="polite"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3"><div><h3 className="tick">{t("pharma.simulationImpact")}</h3><p className="mt-1 text-[11px] text-[var(--muted)]">{running ? t("pharma.runningSimulation") : t("pharma.beforeAfter")}</p></div><span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">{t("pharma.simulatedState")}</span></header><div className="divide-y divide-[var(--border)]">{rows.map(([label, before, after, type]) => <div key={label} className="grid grid-cols-[minmax(72px,1fr)_auto_1rem_auto] items-center gap-2 px-3 py-3 text-xs sm:grid-cols-[minmax(90px,1fr)_auto_1.1rem_auto] sm:gap-3 sm:px-4"><span className="break-words text-[var(--muted)]">{label}</span><span className="mono font-bold" style={{ color: type === "risk" ? riskTone[before as RiskLevel] : undefined }}>{formatValue(before)}</span><span className="text-center text-[var(--accent)]">→</span><span className="mono font-bold" style={{ color: type === "risk" ? riskTone[after as RiskLevel] : type === "score" ? scoreTone(Number(after)) : undefined }}>{formatValue(after)}</span></div>)}</div>{delta.contributors.length > 0 && <div className="border-t border-[var(--border)] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{t("pharma.riskContributors")}</p><div className="mt-2 flex flex-wrap gap-2">{delta.contributors.map((item) => <span key={item.kind} className="rounded-full border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text)]">{t(`pharma.contributor.${item.kind}`)}</span>)}</div></div>}</section>;
}

function planLabel(t: ReturnType<typeof useLanguage>["t"], index: number) { return index === 0 ? t("pharma.currentPlan") : t("pharma.alternativePlan", { letter: index === 1 ? "A" : "B" }); }
function metricLabel(t: ReturnType<typeof useLanguage>["t"], key: string) { return ({ bleedingRisk: t("pharma.bleeding"), renalRisk: t("pharma.renalBurden"), cardiovascularRisk: t("pharma.cardiovascular"), overallRisk: t("pharma.riskScore"), interactionCount: t("pharma.interactions"), stabilityScore: t("pharma.stability"), hepaticRisk: t("pharma.liver"), adverseEventCount: t("pharma.adverseRisk") }[key] ?? key); }
function formatValue(value: number | RiskLevel) { return String(value); }
