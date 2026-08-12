import {
  ORGAN_FUNCTION_STATUSES,
  PREGNANCY_STATUSES,
  type ClinicianMedicationContext,
} from "./types";

export function parseClinicianMedicationContext(input: unknown): ClinicianMedicationContext {
  if (!isRecord(input)) throw new Error("Medication review context is invalid");
  return {
    currentMedications: stringList(input.currentMedications, "currentMedications", 40),
    allergies: stringList(input.allergies, "allergies", 40),
    knownConditions: stringList(input.knownConditions, "knownConditions", 40),
    kidneyFunction: enumValue(input.kidneyFunction, ORGAN_FUNCTION_STATUSES, "kidneyFunction"),
    liverFunction: enumValue(input.liverFunction, ORGAN_FUNCTION_STATUSES, "liverFunction"),
    pregnancyStatus: enumValue(input.pregnancyStatus, PREGNANCY_STATUSES, "pregnancyStatus"),
  };
}

function stringList(value: unknown, field: string, maxItems: number) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${field} is invalid`);
  const items = value.map((item) => {
    if (typeof item !== "string" || !item.trim() || item.length > 120) throw new Error(`${field} is invalid`);
    return item.trim();
  });
  if (items.join("").length > 2_000) throw new Error(`${field} is too large`);
  return items;
}

function enumValue<const T extends readonly string[]>(value: unknown, values: T, field: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) throw new Error(`${field} is invalid`);
  return value as T[number];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
