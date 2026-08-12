import { Priority } from "@/lib/types";
import { PRIORITY_COLOR } from "@/lib/ui";
import { useLanguage } from "@/lib/i18n";

export function PriorityDot({ p, size = 10 }: { p: Priority; size?: number }) {
  return (
    <span
      style={{ background: PRIORITY_COLOR[p], width: size, height: size }}
      className="inline-block rounded-full"
    />
  );
}

export function PriorityBadge({ p, big = false }: { p: Priority; big?: boolean }) {
  const { t } = useLanguage();
  const color = PRIORITY_COLOR[p];
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border font-semibold " +
        (big ? "px-4 py-1.5 text-sm" : "px-2.5 py-1 text-xs")
      }
      style={{
        color,
        borderColor: color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <PriorityDot p={p} size={big ? 10 : 8} />
      {t(`priority.${p}`)}
    </span>
  );
}

export function TriageBar({ p }: { p: Priority }) {
  const pct = { GREEN: 20, YELLOW: 45, ORANGE: 72, RED: 96 }[p];
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-elev)]">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: PRIORITY_COLOR[p] }}
      />
    </div>
  );
}
