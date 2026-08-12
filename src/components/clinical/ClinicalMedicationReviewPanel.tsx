"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import type {
  ClinicianMedicationContext,
  MedicationReviewResponse,
  OrganFunctionStatus,
  PregnancyStatus,
} from "@/lib/clinical-medication-review/types";

type Props = { patientId: string };

const initialContext: ClinicianMedicationContext = {
  currentMedications: [],
  allergies: [],
  knownConditions: [],
  kidneyFunction: "unknown",
  liverFunction: "unknown",
  pregnancyStatus: "unknown",
};

export function ClinicalMedicationReviewPanel({ patientId }: Props) {
  const { t } = useLanguage();
  const [context, setContext] = useState(initialContext);
  const [allergiesReviewed, setAllergiesReviewed] = useState(false);
  const [conditionsReviewed, setConditionsReviewed] = useState(false);
  const [response, setResponse] = useState<MedicationReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const medicationContext = {
        ...context,
        allergies: allergiesReviewed ? context.allergies.length ? context.allergies : ["none_known"] : context.allergies,
        knownConditions: conditionsReviewed ? context.knownConditions.length ? context.knownConditions : ["none_recorded"] : context.knownConditions,
      };
      const result = await fetch(`/api/clinical-medication-review/${encodeURIComponent(patientId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ medicationContext }),
      });
      const body = await result.json() as MedicationReviewResponse & { error?: string };
      if (!result.ok) throw new Error(body.error ?? "Medication review unavailable");
      setResponse(body);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Medication review unavailable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]" aria-label={t("clinical.medicationReview")}> 
      <header className="border-b border-[var(--border)] px-5 py-4">
        <p className="tick">{t("clinical.clinicianOnly")}</p>
        <h2 className="mt-1 text-lg font-semibold">{t("clinical.medicationReview")}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{t("clinical.medicationReviewDescription")}</p>
      </header>

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.62fr)]">
        <div className="space-y-4">
          <TextListField label={t("clinical.currentMedications")} description={t("clinical.currentMedicationsHint")} value={context.currentMedications} onChange={(currentMedications) => setContext((current) => ({ ...current, currentMedications }))} placeholder={t("clinical.medicationPlaceholder")} />
          <TextListField label={t("clinical.allergies")} description={t("clinical.allergiesHint")} value={context.allergies} onChange={(allergies) => setContext((current) => ({ ...current, allergies }))} placeholder={t("clinical.allergyPlaceholder")} />
          <label className="flex items-start gap-2.5 text-sm text-[var(--muted)]"><input type="checkbox" checked={allergiesReviewed} onChange={(event) => setAllergiesReviewed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />{t("clinical.allergiesReviewed")}</label>
          <TextListField label={t("clinical.knownConditions")} description={t("clinical.knownConditionsHint")} value={context.knownConditions} onChange={(knownConditions) => setContext((current) => ({ ...current, knownConditions }))} placeholder={t("clinical.conditionPlaceholder")} />
          <label className="flex items-start gap-2.5 text-sm text-[var(--muted)]"><input type="checkbox" checked={conditionsReviewed} onChange={(event) => setConditionsReviewed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />{t("clinical.conditionsReviewed")}</label>
        </div>
        <div className="space-y-4 rounded-lg bg-black/15 p-4">
          <SelectField label={t("clinical.kidneyFunction")} value={context.kidneyFunction} onChange={(kidneyFunction) => setContext((current) => ({ ...current, kidneyFunction }))} options={organOptions(t)} />
          <SelectField label={t("clinical.liverFunction")} value={context.liverFunction} onChange={(liverFunction) => setContext((current) => ({ ...current, liverFunction }))} options={organOptions(t)} />
          <SelectField label={t("clinical.pregnancyStatus")} value={context.pregnancyStatus} onChange={(pregnancyStatus) => setContext((current) => ({ ...current, pregnancyStatus }))} options={pregnancyOptions(t)} />
          <button type="button" onClick={() => void submit()} disabled={loading} className="sensor-primary-button mt-2 w-full">
            {loading ? t("clinical.reviewRunning") : t("clinical.generateReview")}
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
        {error && <p role="alert" className="text-sm text-[var(--orange)]">{t("clinical.reviewUnavailable")}</p>}
        {response && <ReviewResult response={response} />}
        {!response && !error && <p className="max-w-3xl text-xs leading-relaxed text-[var(--muted)]">{t("clinical.medicationReviewNotice")}</p>}
      </div>
    </section>
  );
}

function TextListField({ label, description, value, onChange, placeholder }: { label: string; description: string; value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{description}</span><input value={value.join(", ")} onChange={(event) => onChange(event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} placeholder={placeholder} className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-black/15 px-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]" /></label>;
}

function SelectField<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string }> }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value as T)} className="mt-2 h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-panel)] px-3 text-sm outline-none focus:border-[var(--accent)]">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ReviewResult({ response }: { response: MedicationReviewResponse }) {
  const { t } = useLanguage();
  const gateTitle = response.gate.status === "no_scan_indication" ? t("clinical.noMedicationIndicated") : response.gate.status === "context_incomplete" ? t("clinical.contextIncomplete") : t("clinical.reviewDraft");
  return <div aria-live="polite"><p className="text-sm font-semibold text-[var(--accent)]">{gateTitle}</p><p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-[var(--text)]">{response.message}</p>{response.gate.status === "eligible_for_clinician_review" && <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{t("clinical.humanApprovalRequired")}</p>}</div>;
}

function organOptions(t: ReturnType<typeof useLanguage>["t"]): Array<{ value: OrganFunctionStatus; label: string }> {
  return [{ value: "unknown", label: t("clinical.statusUnknown") }, { value: "normal", label: t("clinical.statusNormal") }, { value: "impaired", label: t("clinical.statusImpaired") }];
}

function pregnancyOptions(t: ReturnType<typeof useLanguage>["t"]): Array<{ value: PregnancyStatus; label: string }> {
  return [{ value: "unknown", label: t("clinical.statusUnknown") }, { value: "not_applicable", label: t("clinical.statusNotApplicable") }, { value: "negative", label: t("clinical.statusNegative") }, { value: "positive", label: t("clinical.statusPositive") }];
}
