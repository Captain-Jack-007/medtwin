"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { ClinicalWorkspace } from "@/components/clinical/ClinicalWorkspace";
import { resolvePatient } from "@/lib/resolve";
import { useMounted } from "@/lib/useMounted";
import { useLanguage } from "@/lib/i18n";
import { isBrowserProductionDataMode } from "@/lib/supabase/env";
import { useProductionPatient } from "@/lib/production/useProductionPatient";

export default function ClinicalPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const mounted = useMounted();
  const productionMode = isBrowserProductionDataMode();
  const productionRecord = useProductionPatient(id, "clinician");
  const patient = productionMode
    ? productionRecord.status === "ready" ? productionRecord.patient : null
    : mounted ? resolvePatient(id) ?? null : undefined;
  if (patient === undefined || (productionMode && productionRecord.status === "loading")) return <><TopBar /><main className="mx-auto max-w-6xl px-5 py-16 text-[var(--muted)]">{t("twin.loading")}</main></>;
  if (patient === null) return <><TopBar /><main className="mx-auto max-w-6xl px-5 py-16"><p className="text-[var(--muted)]">{t("twin.notFound", { id })}</p><Link href="/scan" className="mt-4 inline-flex text-sm text-[var(--accent)]">{t("twin.runScan")}</Link></main></>;
  return <div className="min-h-dvh bg-[var(--bg)]"><TopBar /><ClinicalWorkspace patient={patient} /></div>;
}
