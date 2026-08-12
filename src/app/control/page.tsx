"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { NavoiyMapPanel } from "@/components/map/NavoiyMapPanel";
import { CLINICS, VILLAGES } from "@/lib/region";
import { recommendDispatch, regionStats } from "@/lib/dispatch";
import { getMedTwinLocations } from "@/data/navoiyLocations";
import { ClinicStatus, DispatchRecommendation } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { useLanguage } from "@/lib/i18n";
import { PharmaIntelligencePanel } from "@/components/pharma/PharmaIntelligencePanel";
import { getPharmaScenario } from "@/lib/pharma/scenarios";
import type { OrganSystem } from "@/lib/pharma/types";
import type { PharmaTwinState } from "@/lib/pharma/types";

// Real place-name lookup for the activity feed (presentation layer).
const PLACE_NAME: Record<string, string> = Object.fromEntries(
  getMedTwinLocations().map((l) => [l.id, l.name])
);

// The demo "inject" action escalates the Uchquduq area for the walkthrough.
const INJECT_TARGET = "v-i";

const STATUS_COLOR: Record<ClinicStatus, string> = {
  AVAILABLE: "var(--green)",
  EN_ROUTE: "var(--accent)",
  ON_MISSION: "var(--yellow)",
  OFFLINE: "var(--muted)",
};

export default function ControlPage() {
  const { t } = useLanguage();
  const baseStats = useMemo(() => regionStats(), []);
  const baseRec = useMemo(() => recommendDispatch(), []);
  const [dispatched, setDispatched] = useState<DispatchRecommendation | null>(
    null
  );
  const [injected, setInjected] = useState(false);
  const [workspace, setWorkspace] = useState<"operations" | "pharma">("operations");
  const [pharmaFocus, setPharmaFocus] = useState<OrganSystem | "cardiovascular" | null>(null);
  const [pharmaTwinState, setPharmaTwinState] = useState<PharmaTwinState | null>(null);
  const pharmaScenario = useMemo(() => getPharmaScenario("MT-1042"), []);

  // Injecting a high-priority patient escalates the Uchquduq area and reframes
  // the AI recommendation onto it, without mutating the deterministic engine.
  const injectedHigh = injected ? 3 : 2; // v-i base high = 2
  const recommendation: DispatchRecommendation | null = injected
    ? {
        clinicId: "clinic-02",
        villageId: INJECT_TARGET,
        villageName: PLACE_NAME[INJECT_TARGET] ?? "Uchquduq",
        reasons: [
          t("control.highCount", { count: injectedHigh }),
          t("control.injected"),
        ],
        highCount: injectedHigh,
        systemBreakdown: { cardiovascular: 2, neurological: 1 },
        etaMin: 44,
      }
    : baseRec;

  const stats = injected
    ? { ...baseStats, high: baseStats.high + 1 }
    : baseStats;
  const focusId = injected ? INJECT_TARGET : dispatched?.villageId ?? null;

  const clinics = CLINICS.map((c) =>
    dispatched && c.id === dispatched.clinicId
      ? { ...c, status: "EN_ROUTE" as ClinicStatus, etaMin: dispatched.etaMin, targetVillageId: dispatched.villageId }
      : c
  );

  return (
    <>
      <TopBar live />
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-5 sm:py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.02em]">{t("control.title")}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("control.description")}</p>
          </div>
          <div className="grid w-full grid-cols-2 border border-[var(--border)] p-1 sm:flex sm:w-auto" role="tablist" aria-label={t("control.workspace")}>
            {(["operations", "pharma"] as const).map((view) => <button key={view} type="button" role="tab" aria-selected={workspace === view} onClick={() => setWorkspace(view)} className={`min-h-9 px-3 text-xs font-semibold uppercase tracking-[0.06em] transition-colors ${workspace === view ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}>{view === "operations" ? t("control.operations") : t("control.pharma")}</button>)}
          </div>
        </header>
        {workspace === "pharma" ? (
          <section aria-label={t("control.pharma")} className="mx-auto max-w-4xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3">
              <div><p className="tick">{t("control.selectedPatient")}</p><p className="mono mt-1 text-lg font-bold">MT-1042</p></div>
              <div className="flex flex-wrap items-center gap-2">{pharmaTwinState?.mode === "simulated" && <span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">{t("control.simulationActive", { plan: pharmaTwinState.treatmentPlanId === "alternative-a" ? t("pharma.alternativePlan", { letter: "A" }) : t("pharma.alternativePlan", { letter: "B" }) })}</span>}<Link href={`/clinical/MT-1042${pharmaFocus ? `?view=twin&organ=${pharmaFocus}` : ""}`} className="sensor-secondary-button inline-flex items-center gap-2 !text-xs">{pharmaFocus ? t("control.openTwin", { organ: pharmaFocus === "renal" ? t("control.kidneys") : pharmaFocus === "hepatic" ? t("control.liver") : t("control.heart") }) : t("control.openTwinDefault")}<Icon name="arrow-right" /></Link></div>
            </div>
            <PharmaIntelligencePanel scenario={pharmaScenario} onOrganFocus={setPharmaFocus} onTwinStateChange={setPharmaTwinState} />
          </section>
        ) : <>
        <div className="grid gap-6 lg:grid-cols-[65fr_35fr]">
          {/* map */}
          <div className="h-[360px] sm:h-[460px] lg:h-[520px]">
            <NavoiyMapPanel dispatched={dispatched} focusId={focusId} />
          </div>

          {/* right rail */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t("control.screened")} value={stats.screened.toLocaleString()} />
              <Stat label={t("control.high")} value={stats.high} accent="var(--red)" />
              <Stat label={t("control.waiting")} value={stats.waitingSpecialist} />
              <Stat label={t("control.clinics")} value={stats.clinics} />
            </div>

            <button
              onClick={() => setInjected(true)}
              disabled={injected}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--red)]/50 bg-[var(--red)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--red)] transition hover:bg-[var(--red)]/20 disabled:opacity-50"
            >
              <Icon name="plus" />
              {injected
                ? t("control.injected")
                : t("control.inject")}
            </button>

            <div className="panel p-5">
              <div className="tick mb-2">{t("control.recommendation")}</div>
              {recommendation ? (
                <>
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <span>{clinicLabel(recommendation.clinicId)}</span>
                    <Icon name="arrow-right" className="text-[var(--accent)]" />
                    <span>{recommendation.villageName}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                    {recommendation.reasons.map((r) => (
                      <li key={r} className="flex items-start gap-2">
                        <Icon
                          name="dot"
                          size="0.6em"
                          className="mt-[0.5em] shrink-0 text-[var(--accent)]"
                        />
                        <span>{r}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2">
                      <Icon
                        name="dot"
                        size="0.6em"
                        className="mt-[0.5em] shrink-0 text-[var(--accent)]"
                      />
                      <span>{t("control.travel", { minutes: recommendation.etaMin })}</span>
                    </li>
                  </ul>
                  <button
                    onClick={() => setDispatched(recommendation)}
                    disabled={!!dispatched}
                    className="mt-4 w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
                  >
                    {dispatched ? t("control.dispatched") : t("control.dispatch")}
                  </button>
                </>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  {t("control.noDispatch")}
                </p>
              )}
            </div>

            <div className="panel p-4">
              <div className="tick mb-2">{t("control.clinics")}</div>
              <div className="divide-y divide-[var(--border)]">
                {clinics.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="mono">{c.label}</span>
                    <span style={{ color: STATUS_COLOR[c.status] }}>
                      {statusText(c.status, t)}
                      {c.status === "EN_ROUTE" && c.etaMin ? ` · ${t("control.travel", { minutes: c.etaMin })}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* live activity */}
        <div className="panel mt-6 p-4">
          <div className="tick mb-3">{t("control.activity")}</div>
          <div className="grid gap-2 md:grid-cols-3">
            {VILLAGES.filter((v) => v.high > 0).map((v) => {
              const high =
                injected && v.id === INJECT_TARGET ? v.high + 1 : v.high;
              return (
                <div key={v.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{PLACE_NAME[v.id] ?? v.name}</span>
                    <span className="text-[var(--red)]">{t("control.highCount", { count: high })}</span>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {t("control.screenedCount", { count: v.screened })} {v.online ? "" : `· ${t("control.offline")}`}
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            href="/scan"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-[var(--accent)]"
          >
            <Icon name="plus" /> {t("control.runScan")}
          </Link>
        </div>
        </>}
      </main>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="panel p-4">
      <div className="tick">{label}</div>
      <div className="mono mt-1 text-2xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
    </div>
  );
}

function clinicLabel(id: string): string {
  return CLINICS.find((c) => c.id === id)?.label ?? id;
}

function statusText(s: ClinicStatus, t: ReturnType<typeof useLanguage>["t"]): string {
  return {
    AVAILABLE: t("status.available"),
    EN_ROUTE: t("status.enRoute"),
    ON_MISSION: t("status.onMission"),
    OFFLINE: t("status.offline"),
  }[s];
}
