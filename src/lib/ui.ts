// Shared UI helpers: priority color mapping + small utilities.
import { Priority, SignalQuality } from "./types";

export const PRIORITY_COLOR: Record<Priority, string> = {
  GREEN: "var(--green)",
  YELLOW: "var(--yellow)",
  ORANGE: "var(--orange)",
  RED: "var(--red)",
};

export const PRIORITY_TEXT: Record<Priority, string> = {
  GREEN: "GREEN",
  YELLOW: "YELLOW",
  ORANGE: "ORANGE",
  RED: "RED",
};

export const PRIORITY_HEADLINE: Record<Priority, string> = {
  GREEN: "LOW PRIORITY",
  YELLOW: "ROUTINE",
  ORANGE: "ELEVATED PRIORITY",
  RED: "HIGH PRIORITY",
};

export const ACTION_TEXT: Record<string, string> = {
  incomplete_screening_review:
    "Screening is incomplete. Repeat unavailable tasks or seek professional assessment based on symptoms.",
  self_care_or_review: "Self-care or routine review.",
  routine_review: "Monitor and arrange routine review.",
  professional_assessment: "Seek professional medical assessment.",
  urgent_professional_assessment:
    "Seek urgent professional medical assessment.",
};

export function signalColor(q: SignalQuality): string {
  return q === "GOOD"
    ? "var(--green)"
    : q === "FAIR"
    ? "var(--yellow)"
    : "var(--red)";
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
