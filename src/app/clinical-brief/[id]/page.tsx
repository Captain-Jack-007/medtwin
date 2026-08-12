"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { PriorityBadge } from "@/components/PriorityBadge";
import { resolvePatient } from "@/lib/resolve";
import { SYSTEM_META } from "@/lib/types";
import { ACTION_TEXT } from "@/lib/ui";
import { villageById } from "@/lib/region";
import { useMounted } from "@/lib/useMounted";
import { Icon } from "@/components/Icon";
import { SOURCE_LABEL } from "@/lib/measurements/types";
import { useLanguage } from "@/lib/i18n";

export default function ClinicalBriefPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const mounted = useMounted();
  const patient = mounted ? resolvePatient(id) ?? null : undefined;

  if (!patient)
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-3xl px-5 py-16 text-[var(--muted)]">
          {patient === undefined ? t("common.loading") : t("twin.notFound", { id })}
        </main>
      </>
    );

  const { info, session, triage } = patient;
  const realScan = patient.realScan;
  const village = villageById(info.location);
  const primary = triage.systems[0];
  const allUnknown = Object.values(triage.observationStates).every(
    (state) => state === "UNKNOWN"
  );
  const time = new Date(info.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="tick">{t("brief.title")}</span>
          <Link
            href={`/clinical/${info.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--accent)]"
          >
            <Icon name="arrow-left" /> {t("brief.back")}
          </Link>
        </div>

        <div className="panel rise p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="tick">{t("brief.patient")}</div>
              <div className="mono text-2xl font-bold">{info.id}</div>
              <div className="text-sm text-[var(--muted)]">
                {info.sex} · {info.ageRange} · {village?.name ?? info.location}
              </div>
            </div>
            {allUnknown ? (
              <span className="rounded-full border border-[var(--muted)] px-4 py-1.5 text-sm font-semibold text-[var(--muted)]">
                {t("twin.incomplete")}
              </span>
            ) : (
              <PriorityBadge p={triage.priority} big />
            )}
          </div>

          <Section title={t("brief.primary")}>
            {primary
              ? `${SYSTEM_META[primary].label} ${t("brief.warning")}`
              : allUnknown
                ? t("brief.noMeasurements")
                : t("brief.noWarning")}
          </Section>

          <Section title={t("brief.reported")}>
            {info.symptoms.length ? (
              <ul className="list-disc pl-5">
                {info.symptoms.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              t("twin.none")
            )}
            <SourceBadge label={t("brief.userReported")} />
          </Section>

          <Section title={t("brief.observations")}>
            {realScan ? (
              <div className="divide-y divide-[var(--border)] rounded-lg bg-[var(--bg-elev)] px-3">
                <BriefMeasurement
                  label={t("brief.heartRate")}
                  value={realScan.heartRate.value === null ? t("common.notMeasured") : `${realScan.heartRate.value} bpm`}
                  source={realScan.heartRate.algorithm === "camera_ppg_v1" ? "Camera PPG" : SOURCE_LABEL[realScan.heartRate.source]}
                  quality={realScan.heartRate.signalQuality}
                />
                <BriefMeasurement
                  label={t("brief.respiratoryRate")}
                  value={realScan.respiratoryRate.value === null ? t("common.unavailable") : `${realScan.respiratoryRate.value} /min`}
                  source={realScan.respiratoryRate.algorithm === "pose_respiration_v1" ? "Pose-derived estimate" : SOURCE_LABEL[realScan.respiratoryRate.source]}
                  quality={realScan.respiratoryRate.signalQuality}
                />
                <BriefMeasurement
                  label={t("vitals.bloodPressure")}
                  value={realScan.bloodPressure.value ? `${realScan.bloodPressure.value.systolic}/${realScan.bloodPressure.value.diastolic} mmHg` : t("common.notMeasured")}
                  source={SOURCE_LABEL[realScan.bloodPressure.source]}
                  quality={realScan.bloodPressure.signalQuality}
                />
                <BriefMeasurement
                  label="SpO₂"
                  value={realScan.spo2.value === null ? t("common.externalDeviceRequired") : `${realScan.spo2.value}%`}
                  source={SOURCE_LABEL[realScan.spo2.source]}
                  quality={realScan.spo2.signalQuality}
                />
              </div>
            ) : (
              <div>
                <ul className="list-disc pl-5">
                  <li>HR: {session.heartRate} bpm</li>
                  <li>RR: {session.respiratoryRate} /min</li>
                </ul>
                <SourceBadge label={t("brief.synthetic")} warning />
              </div>
            )}
          </Section>

          {!realScan && session.systolic != null && (
            <Section title={t("twin.demo")}>
              <ul className="list-disc pl-5">
                <li>BP: {session.systolic}/{session.diastolic} mmHg</li>
                {session.spo2 != null && <li>SpO₂: {session.spo2}%</li>}
              </ul>
            </Section>
          )}

          <Section title={t("brief.triage")}>
            {ACTION_TEXT[triage.recommendedAction]}
          </Section>

          {realScan && (
            <Section title={t("brief.tasks")}>
              <div className="space-y-2 text-sm">
                <TaskLine label={t("brief.facial")} value={realScan.facialSymmetry.value?.classification ?? "INSUFFICIENT_SIGNAL"} source="Camera / face landmarks" />
                <TaskLine label={t("brief.movement")} value={realScan.movementSymmetry.value?.classification ?? "INSUFFICIENT_SIGNAL"} source="Camera / pose landmarks" />
                <TaskLine label={t("brief.speech")} value={realScan.speechTask.value?.classification ?? "INSUFFICIENT_SIGNAL"} source="Microphone / voice activity" />
              </div>
            </Section>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
            <span>{t("brief.generated")} {time}</span>
            <span className="mono">rules {triage.ruleVersion}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-[var(--muted)]">
          {t("brief.disclaimer")}
        </p>
      </main>
    </>
  );
}

function BriefMeasurement({
  label,
  value,
  source,
  quality,
}: {
  label: string;
  value: string;
  source: string;
  quality: number | null;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span>{label}</span>
      <span className="text-right">
        <span className="mono block">{value}</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
          {source}{quality !== null ? ` · quality ${Math.round(quality * 100)}%` : ""}
        </span>
      </span>
    </div>
  );
}

function TaskLine({ label, value, source }: { label: string; value: string; source: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-elev)] px-3 py-2">
      <span>{label}</span>
      <span className="text-right">
        <span className="mono block text-xs">{value}</span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">{source}</span>
      </span>
    </div>
  );
}

function SourceBadge({ label, warning = false }: { label: string; warning?: boolean }) {
  return (
    <span
      className="mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color: warning ? "var(--yellow)" : "var(--muted)",
        borderColor: warning ? "var(--yellow)" : "var(--border)",
      }}
    >
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="tick mb-1">{title}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
