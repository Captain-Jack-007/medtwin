"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import type { PatientResultSummary } from "@/lib/patient-results";

export function PatientResultsAIPanel({ patientId, summary }: { patientId: string; summary: PatientResultSummary }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = async (prompt: string) => {
    const question = prompt.trim();
    if (!question || loading) return;
    setMessages((items) => [...items, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/medtwin-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: `results-${patientId}`,
          audience: "patient",
          requestType: "ANSWER_PATIENT_QUESTION",
          question,
          patientContext: {
            resultSummary: summary.status,
            measurements: summary.measurements.map((item) => ({ label: item.key, value: item.value, status: item.status })),
            detectedSignals: [],
            unavailableMeasurements: summary.measurements.filter((item) => item.status === "not_measured" || item.status === "device_required" || item.status === "unavailable").map((item) => item.key),
          },
        }),
      });
      const body = await response.json() as { message?: string; error?: string };
      setMessages((items) => [...items, { role: "assistant", content: response.ok ? body.message ?? t("results.aiUnavailable") : body.error ?? t("results.aiUnavailable") }]);
    } catch {
      setMessages((items) => [...items, { role: "assistant", content: t("results.aiUnavailable") }]);
    } finally {
      setLoading(false);
    }
  };
  const prompts = ["results.promptMeaning", "results.promptBloodPressure", "results.promptDevice", "results.promptSimple"] as const;
  return <section aria-label={t("results.aiTitle")} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]"><header className="border-b border-[var(--border)] px-4 py-4"><h2 className="text-lg font-semibold">{t("results.aiTitle")}</h2><p className="mt-1 text-xs text-[var(--muted)]">{t("results.aiDescription")}</p></header><div className="flex flex-wrap gap-2 px-4 py-3">{prompts.map((key) => <button key={key} type="button" disabled={loading} onClick={() => void ask(t(key))} className="min-h-10 rounded-full border border-[var(--border)] px-3 py-1.5 text-left text-xs text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50">{t(key)}</button>)}</div>{messages.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto border-t border-[var(--border)] px-4 py-3" aria-live="polite">{messages.map((message, index) => <p key={`${message.role}-${index}`} className={`whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "ml-5 bg-[var(--accent)]/10" : "mr-3 bg-black/20"}`}>{message.content}</p>)}{loading && <p className="text-xs text-[var(--accent)]">{t("common.loading")}</p>}</div>}<form className="flex flex-col gap-2 border-t border-[var(--border)] p-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void ask(input); }}><label className="sr-only" htmlFor="results-question">{t("results.ask")}</label><input id="results-question" value={input} maxLength={700} onChange={(event) => setInput(event.target.value)} placeholder={t("results.askPlaceholder")} className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent-2)]" /><button type="submit" disabled={loading || !input.trim()} className="sensor-primary-button w-full px-3 text-xs sm:w-auto">{t("results.explain")}</button></form></section>;
}
