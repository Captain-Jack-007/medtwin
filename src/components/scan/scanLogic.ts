export const SYMPTOM_OPTIONS = [
  "Chest discomfort",
  "Shortness of breath",
  "Palpitations",
  "Dizziness",
  "Persistent cough",
  "Severe headache",
  "Numbness in arm",
  "Fatigue",
] as const;

export const CUSTOM_SYMPTOM_KEY = "__custom_symptom__";
export type SymptomOption = (typeof SYMPTOM_OPTIONS)[number];
