"use client";

import { useLanguage } from "@/lib/i18n";

export function StepScreen({
  title,
  children,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled = false,
}: {
  title: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="panel rise p-4 sm:p-6">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div>{children}</div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="sensor-secondary-button w-full sm:w-auto"
          >
            {t("common.back")}
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="sensor-primary-button w-full sm:w-auto"
        >
          {nextLabel === "Continue" ? t("common.continue") : nextLabel}
        </button>
      </div>
    </div>
  );
}
