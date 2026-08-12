"use client";

// Dark, premium popup bodies for the Leaflet map. Popups render inside
// Leaflet's default container, which we restyle in globals.css (.mt-popup).
import { MedTwinClinic, MedTwinLocation } from "@/data/navoiyLocations";
import { RISK_COLOR, RiskLevel, ClinicStatus } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

export function LocationPopup({
  loc,
  risk,
}: {
  loc: MedTwinLocation;
  risk: RiskLevel;
}) {
  const { t } = useLanguage();
  const demo = loc.type === "demo-community";
  const riskWord: Record<RiskLevel, string> = {
    LOW: t("map.low"), MODERATE: t("map.moderate"), HIGH: t("map.high"), CRITICAL: t("map.critical"),
  };
  return (
    <div className="mt-popup-body">
      <div className="mt-popup-head">
        <span>{loc.name}</span>
        <span className="mt-popup-risk" style={{ color: RISK_COLOR[risk] }}>
          {riskWord[risk]}
        </span>
      </div>
      <div className="mt-popup-sub">
        {demo ? t("map.demoCommunity") : t("map.realLocation")}
      </div>
      <dl className="mt-popup-grid">
        <Row label={t("map.screened")} value={loc.screenedPatients} />
        <Row label={t("control.high")} value={loc.highPriority} />
        <Row label={t("map.waiting")} value={loc.waitingSpecialist} />
        <Row label={t("map.cardiovascular")} value={loc.cardiovascular} />
        <Row label={t("map.respiratory")} value={loc.respiratory} />
        <Row label={t("map.neurological")} value={loc.neurological} />
      </dl>
    </div>
  );
}

export function ClinicPopup({ clinic }: { clinic: MedTwinClinic }) {
  const { t } = useLanguage();
  const clinicWord: Record<ClinicStatus, string> = {
    AVAILABLE: t("status.available"), EN_ROUTE: t("status.enRoute"), ON_MISSION: t("status.onMission"), OFFLINE: t("status.offline"),
  };
  return (
    <div className="mt-popup-body">
      <div className="mt-popup-head">
        <span className="mono">{clinic.label}</span>
        <span className="mt-popup-risk">{clinicWord[clinic.status]}</span>
      </div>
      <div className="mt-popup-sub">
        {t("map.near")} {clinic.anchorName}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="mono">{value}</dd>
    </>
  );
}
