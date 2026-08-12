"use client";

import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { allScenarios } from "@/lib/scenarios";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const { t } = useLanguage();
  const scenarios = allScenarios();
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-5">
        <section className="grid items-center gap-8 py-10 sm:py-16 md:grid-cols-2 md:py-24">
          <div className="rise">
            <span className="tick">{t("home.eyebrow")}</span>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-4xl md:text-5xl">
              {t("home.title")}
              <br />
              <span className="text-[var(--accent)]">
                {t("home.titleAccent")}
              </span>
            </h1>
            <p className="mt-4 max-w-md text-[var(--muted)]">
              {t("home.description")}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/scan"
                className="min-h-11 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-black transition hover:brightness-110"
              >
                {t("home.start")}
              </Link>
              <Link
                href="/control"
                className="min-h-11 rounded-xl border border-[var(--border)] px-5 py-3 font-semibold transition hover:bg-[var(--bg-elev)]"
              >
                {t("home.control")}
              </Link>
            </div>
            <p className="mt-6 max-w-md text-xs text-[var(--muted)]">
              {t("home.disclaimer")}
            </p>
          </div>

          <div className="panel p-6">
            <div className="tick mb-3">{t("home.scenarios")}</div>
            <div className="grid gap-3">
              {scenarios.map((s) => (
                <Link
                  key={s.info.id}
                  href={`/twin/${s.info.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3 transition hover:border-[var(--accent)]"
                >
                  <div>
                    <div className="font-semibold">{s.info.id}</div>
                    <div className="text-xs text-[var(--muted)]">
                      {scenarioTitle(s.info.id, t)}
                    </div>
                  </div>
                  <PriorityBadge p={s.triage.priority} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-20 md:grid-cols-3">
          {[
            [t("home.phoneTitle"), t("home.phoneText")],
            [t("home.twinTitle"), t("home.twinText")],
            [t("home.towerTitle"), t("home.towerText")],
          ].map(([t, d]) => (
            <div key={t} className="panel p-5">
              <div className="font-semibold">{t}</div>
              <p className="mt-2 text-sm text-[var(--muted)]">{d}</p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}

function scenarioTitle(id: string, t: ReturnType<typeof useLanguage>["t"]): string {
  const map: Record<string, ReturnType<typeof t>> = {
    "MT-A01": t("home.normal"),
    "MT-014": t("home.cardiovascular"),
    "MT-051": t("home.neurological"),
    "MT-077": t("home.respiratory"),
  };
  return map[id] ?? t("home.scenarios");
}
