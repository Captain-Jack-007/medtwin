"use client";

import { useState } from "react";
import type { PharmaFinding, PharmaScenario, TreatmentPlan, TreatmentSimulationResult } from "@/lib/pharma/types";
import { useLanguage } from "@/lib/i18n";

export function PharmaAIPanel({ scenario, finding, currentPlan, selectedPlan, selectedSimulation, candidateId, audience = "clinician" }: { scenario: PharmaScenario; finding: PharmaFinding | null; currentPlan: TreatmentPlan; selectedPlan: TreatmentPlan; selectedSimulation: TreatmentSimulationResult; candidateId?: string; audience?: "clinician" }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async (prompt: string, requestType?: "EXPLAIN_PHARMA_RISK" | "COMPARE_TREATMENTS" | "EXPLAIN_ORGAN_RISK") => {
    const question = prompt.trim();
    if (!question || loading) return;
    setMessages((current) => [...current, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/medtwin-ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: `pharma-${scenario.patientId}`, scenarioId: scenario.id, audience, requestType: requestType ?? (finding?.relatedSystem ? "EXPLAIN_ORGAN_RISK" : "EXPLAIN_PHARMA_RISK"), selectedFindingId: finding?.id, selectedPlanId: selectedSimulation.treatmentPlanId, candidateId, question }) });
      const body = await response.json() as { message?: string; error?: string };
      setMessages((current) => [...current, { role: "assistant", content: response.ok ? body.message ?? t("pharma.unavailable") : body.error ?? t("pharma.unavailable") }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: t("pharma.unavailable") }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="pharma-ai" aria-label={t("pharma.aiTitle")} className="mt-5 overflow-hidden rounded-xl border border-[var(--border)] bg-[rgba(19,28,43,0.62)]">
      <header className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-xs font-black text-[#04100f]">M</span>
        <div><h3 className="text-sm font-semibold">{t("pharma.aiTitle")}</h3><p className="mt-0.5 text-[11px] text-[var(--muted)]">{t("pharma.aiDescription")}</p></div>
      </header>
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {(selectedPlan.id === currentPlan.id ? ["pharma.promptRisk", "pharma.promptKidney", "pharma.promptSimple"] : ["pharma.promptWhyChanged", "pharma.promptFactors", "pharma.promptCompare", "pharma.promptTwin"]).map((key) => <button key={key} type="button" disabled={loading} onClick={() => ask(t(key as "pharma.promptRisk"), key === "pharma.promptCompare" || key === "pharma.promptWhyChanged" || key === "pharma.promptFactors" ? "COMPARE_TREATMENTS" : key === "pharma.promptKidney" || key === "pharma.promptTwin" ? "EXPLAIN_ORGAN_RISK" : "EXPLAIN_PHARMA_RISK")} className="rounded-full border border-[var(--border)] px-2.5 py-1.5 text-left text-[11px] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50">{t(key as "pharma.promptRisk")}</button>)}
      </div>
      {messages.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto border-t border-[var(--border)] px-4 py-3" aria-live="polite">
        {messages.map((message, index) => <p key={`${message.role}-${index}`} className={`whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "ml-5 bg-[var(--accent)]/10" : "mr-3 bg-black/20"}`}>{message.content}</p>)}
        {loading && <p className="text-xs text-[var(--accent)]">{t("pharma.aiLoading")}</p>}
      </div>}
      <form className="flex flex-col gap-2 border-t border-[var(--border)] p-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void ask(input); }}>
        <label className="sr-only" htmlFor="pharma-question">{t("pharma.ask")}</label><input id="pharma-question" value={input} maxLength={700} onChange={(event) => setInput(event.target.value)} placeholder={t("pharma.askPlaceholder")} className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-black/20 px-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-2)]" />
        <button type="submit" disabled={loading || !input.trim()} className="sensor-primary-button w-full px-3 text-xs sm:w-auto">{t("pharma.explain")}</button>
      </form>
    </section>
  );
}
