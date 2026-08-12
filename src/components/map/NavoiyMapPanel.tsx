"use client";

// Control Tower map panel. Loads the real Leaflet map client-only and falls
// back to the synthetic SVG control map if tiles fail to load (offline safety).
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { NavoiyMap } from "@/components/NavoiyMap";
import { DispatchRecommendation } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

const RealNavoiyMap = dynamic(() => import("./RealNavoiyMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <span className="mt-spin inline-block h-3 w-3 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        {t("map.loading")}
      </div>
    </div>
  );
}

export function NavoiyMapPanel({
  dispatched,
  focusId,
}: {
  dispatched?: DispatchRecommendation | null;
  focusId?: string | null;
}) {
  const { t } = useLanguage();
  const [showRisk, setShowRisk] = useState(true);
  const [showClinics, setShowClinics] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [tileFailed, setTileFailed] = useState(false);

  // Remounting the map resets the camera to the overview bounds.
  const mapEl = useMemo(
    () => (
      <RealNavoiyMap
        key={resetKey}
        dispatched={dispatched}
        focusId={focusId}
        showRisk={showRisk}
        showClinics={showClinics}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onTileError={() => setTileFailed(true)}
      />
    ),
    [resetKey, dispatched, focusId, showRisk, showClinics, selectedId]
  );

  if (tileFailed) {
    return (
      <div className="panel relative isolate h-full overflow-hidden">
        <NavoiyMap dispatched={dispatched} onSelect={setSelectedId} />
        <div className="pointer-events-none absolute bottom-2 left-3 right-3">
          <p className="rounded bg-black/50 px-2 py-1 text-[10px] text-[var(--muted)] backdrop-blur">
            {t("map.fallback")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel relative isolate h-full overflow-hidden">
      {mapEl}

      {/* header label */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] hidden flex-col gap-1 sm:flex">
        <span className="tick rounded bg-black/45 px-2 py-1 backdrop-blur">
          {t("map.region")}
        </span>
        <span className="rounded bg-black/45 px-2 py-0.5 text-[9px] text-[var(--muted)] backdrop-blur">
          {t("map.synthetic")}
        </span>
      </div>

      {/* controls */}
      <div className="absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap items-center gap-2 sm:bottom-auto sm:left-auto sm:right-3 sm:top-3 sm:flex-col sm:items-end sm:gap-1.5">
        <Toggle on={showRisk} onClick={() => setShowRisk((v) => !v)}>
          {t("map.risk")}
        </Toggle>
        <Toggle on={showClinics} onClick={() => setShowClinics((v) => !v)}>
          {t("map.mobileClinics")}
        </Toggle>
        <button
          onClick={() => {
            setSelectedId(null);
            setResetKey((k) => k + 1);
          }}
          className="min-h-11 rounded-md border border-[var(--border)] bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text)] backdrop-blur transition hover:brightness-125"
        >
          {t("map.overview")}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-11 items-center gap-1.5 rounded-md border bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur transition"
      style={{
        borderColor: on ? "var(--accent)" : "var(--border)",
        color: on ? "var(--text)" : "var(--muted)",
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: on ? "var(--accent)" : "var(--muted)" }}
      />
      {children}
    </button>
  );
}
