"use client";

import { useEffect, useState } from "react";
import {
  DeviceCapabilities,
  inspectDeviceCapabilities,
} from "@/lib/sensors/media";
import { useLanguage } from "@/lib/i18n";

export function CapabilityPanel() {
  const { t } = useLanguage();
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);

  useEffect(() => {
    let active = true;
    void inspectDeviceCapabilities().then((next) => {
      if (active) setCapabilities(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const rows = capabilities
    ? [
        [t("sensor.secure"), capabilities.secureContext],
        [t("sensor.camera"), capabilities.mediaDevices && capabilities.camera !== "unavailable"],
        [t("sensor.microphone"), capabilities.mediaDevices && capabilities.microphone !== "unavailable"],
        [t("sensor.runtime"), capabilities.webAssembly && capabilities.webGL],
        [t("sensor.models"), capabilities.visionModels],
      ] as const
    : [];

  return (
    <div className="mt-5 rounded-xl bg-[var(--bg-elev)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{t("sensor.capabilities")}</span>
        <span className="mono text-xs text-[var(--muted)]">
          {capabilities ? t("sensor.complete") : t("sensor.checking")}
        </span>
      </div>
      <div className="space-y-2">
        {rows.map(([label, available]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">{label}</span>
            <span style={{ color: available ? "var(--green)" : "var(--yellow)" }}>
              {available ? t("status.available") : t("common.unavailable")}
            </span>
          </div>
        ))}
        {!capabilities && (
          <div className="h-20 animate-pulse rounded-lg bg-[var(--border)]/60" />
        )}
      </div>
      {capabilities && !capabilities.secureContext && (
        <p className="mt-3 text-sm text-[var(--yellow)]">
          {t("sensor.https")}
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
        {t("sensor.permissionNote")}
      </p>
    </div>
  );
}
