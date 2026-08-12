import { TriageResult } from "@/lib/types";
import { ACTION_TEXT, PRIORITY_HEADLINE } from "@/lib/ui";
import { Icon } from "@/components/Icon";

export function WhyPanel({ triage }: { triage: TriageResult }) {
  const contributing = triage.evidence.filter((e) => e.contributes !== false);
  return (
    <div className="panel rise p-5">
      <h3 className="text-lg font-semibold">
        Why {PRIORITY_HEADLINE[triage.priority].toLowerCase()}?
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {contributing.length} available signal(s) contributed to this triage priority.
      </p>
      <ol className="mt-4 space-y-3">
        {triage.evidence.map((e, i) => (
          <li key={e.code} className="flex gap-3">
            <span className="mono text-sm text-[var(--accent)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-sm">
              <span>{e.text}</span>
              {e.synthetic && (
                <span className="text-[var(--accent)]">*</span>
              )}
              {(e.source || e.quality !== undefined) && (
                <span className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {e.source && <span>{e.source}</span>}
                  {e.quality !== undefined && e.quality !== null && (
                    <span>Quality {Math.round(e.quality * 100)}%</span>
                  )}
                  {e.contributes === false && <span>Not used in priority</span>}
                </span>
              )}
            </span>
          </li>
        ))}
        {triage.evidence.length === 0 && (
          <li className="text-sm text-[var(--muted)]">
            No available warning signal raised the priority. Unavailable
            measurements remain unknown and are not treated as normal.
          </li>
        )}
      </ol>
      <div className="mt-5 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] p-3">
        <div className="tick">Recommendation</div>
        <div className="mt-1 text-sm font-medium">
          {ACTION_TEXT[triage.recommendedAction]}
        </div>
      </div>
      <p className="mt-3 inline-flex flex-wrap items-center gap-1 text-[11px] text-[var(--muted)]">
        Evidence
        <Icon name="arrow-right" className="inline" />
        decision is produced by a deterministic rules engine (v
        {triage.ruleVersion}). This is triage, not a diagnosis.
      </p>
    </div>
  );
}
