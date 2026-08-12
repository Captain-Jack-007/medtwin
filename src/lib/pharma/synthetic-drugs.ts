import type { Medication } from "./types";

export const SYNTHETIC_DRUGS: Record<string, Medication> = {
  warfarin: {
    id: "warfarin", genericName: "Warfarin", category: "Anticoagulant", dose: "5 mg", frequency: "daily",
    renalSensitivity: "LOW", hepaticSensitivity: "HIGH", adverseEventSignals: ["Synthetic bleeding-risk marker"],
  },
  ibuprofen: {
    id: "ibuprofen", genericName: "Ibuprofen", category: "NSAID", dose: "600 mg", frequency: "three times daily",
    renalSensitivity: "HIGH", hepaticSensitivity: "MODERATE", adverseEventSignals: ["Synthetic gastric bleeding marker"],
  },
  acetaminophen: {
    id: "acetaminophen", genericName: "Acetaminophen", category: "Analgesic", dose: "500 mg", frequency: "as configured",
    renalSensitivity: "LOW", hepaticSensitivity: "MODERATE", adverseEventSignals: [],
  },
  apixaban: {
    id: "apixaban", genericName: "Apixaban", category: "Anticoagulant", dose: "5 mg", frequency: "twice daily",
    renalSensitivity: "MODERATE", hepaticSensitivity: "MODERATE", adverseEventSignals: [],
  },
  dabigatran: {
    id: "dabigatran", genericName: "Dabigatran", category: "Anticoagulant", dose: "150 mg", frequency: "twice daily",
    renalSensitivity: "HIGH", hepaticSensitivity: "LOW", adverseEventSignals: ["Synthetic renal accumulation marker"],
  },
  rivaroxaban: {
    id: "rivaroxaban", genericName: "Rivaroxaban", category: "Anticoagulant", dose: "20 mg", frequency: "daily",
    renalSensitivity: "MODERATE", hepaticSensitivity: "MODERATE", adverseEventSignals: [],
  },
  aspirin: {
    id: "aspirin", genericName: "Acetylsalicylic acid", category: "Antiplatelet agent", dose: "75 mg", frequency: "daily",
    renalSensitivity: "MODERATE", hepaticSensitivity: "LOW", adverseEventSignals: ["Synthetic bleeding monitoring marker"],
  },
  diclofenac: {
    id: "diclofenac", genericName: "Diclofenac", category: "NSAID", dose: "50 mg", frequency: "twice daily",
    renalSensitivity: "HIGH", hepaticSensitivity: "HIGH", adverseEventSignals: ["Synthetic gastric bleeding marker", "Synthetic hepatic monitoring marker"],
  },
  naproxen: {
    id: "naproxen", genericName: "Naproxen", category: "NSAID", dose: "250 mg", frequency: "twice daily",
    renalSensitivity: "HIGH", hepaticSensitivity: "MODERATE", adverseEventSignals: ["Synthetic gastric bleeding marker"],
  },
  meloxicam: {
    id: "meloxicam", genericName: "Meloxicam", category: "NSAID", dose: "7.5 mg", frequency: "daily",
    renalSensitivity: "HIGH", hepaticSensitivity: "MODERATE", adverseEventSignals: ["Synthetic renal monitoring marker"],
  },
  amlodipine: {
    id: "amlodipine", genericName: "Amlodipine", category: "Cardiovascular agent", dose: "5 mg", frequency: "daily",
    renalSensitivity: "LOW", hepaticSensitivity: "MODERATE", adverseEventSignals: [],
  },
  bisoprolol: {
    id: "bisoprolol", genericName: "Bisoprolol", category: "Cardiovascular agent", dose: "5 mg", frequency: "daily",
    renalSensitivity: "LOW", hepaticSensitivity: "LOW", adverseEventSignals: [],
  },
  losartan: {
    id: "losartan", genericName: "Losartan", category: "Cardiovascular agent", dose: "50 mg", frequency: "daily",
    renalSensitivity: "MODERATE", hepaticSensitivity: "LOW", adverseEventSignals: [],
  },
  hydrochlorothiazide: {
    id: "hydrochlorothiazide", genericName: "Hydrochlorothiazide", category: "Diuretic", dose: "12.5 mg", frequency: "daily",
    renalSensitivity: "MODERATE", hepaticSensitivity: "LOW", adverseEventSignals: ["Synthetic electrolyte monitoring marker"],
  },
  furosemide: {
    id: "furosemide", genericName: "Furosemide", category: "Diuretic", dose: "40 mg", frequency: "daily",
    renalSensitivity: "MODERATE", hepaticSensitivity: "LOW", adverseEventSignals: ["Synthetic volume monitoring marker"],
  },
  omeprazole: {
    id: "omeprazole", genericName: "Omeprazole", category: "Gastroprotective agent", dose: "20 mg", frequency: "daily",
    renalSensitivity: "LOW", hepaticSensitivity: "MODERATE", adverseEventSignals: [],
  },
  pantoprazole: {
    id: "pantoprazole", genericName: "Pantoprazole", category: "Gastroprotective agent", dose: "40 mg", frequency: "daily",
    renalSensitivity: "LOW", hepaticSensitivity: "MODERATE", adverseEventSignals: [],
  },
  metformin: {
    id: "metformin", genericName: "Metformin", category: "Metabolic agent", dose: "1000 mg", frequency: "twice daily",
    renalSensitivity: "HIGH", hepaticSensitivity: "LOW", adverseEventSignals: ["Synthetic accumulation signal"],
  },
  lisinopril: {
    id: "lisinopril", genericName: "Lisinopril", category: "Cardiovascular agent", dose: "20 mg", frequency: "daily",
    renalSensitivity: "MODERATE", hepaticSensitivity: "LOW", adverseEventSignals: [],
  },
  spironolactone: {
    id: "spironolactone", genericName: "Spironolactone", category: "Diuretic", dose: "25 mg", frequency: "daily",
    renalSensitivity: "HIGH", hepaticSensitivity: "MODERATE", adverseEventSignals: ["Synthetic electrolyte monitoring marker"],
  },
  atorvastatin: {
    id: "atorvastatin", genericName: "Atorvastatin", category: "Lipid-lowering agent", dose: "40 mg", frequency: "daily",
    renalSensitivity: "LOW", hepaticSensitivity: "HIGH", adverseEventSignals: ["Synthetic hepatic monitoring marker"],
  },
};

export function medication(id: keyof typeof SYNTHETIC_DRUGS): Medication {
  return { ...SYNTHETIC_DRUGS[id], adverseEventSignals: [...SYNTHETIC_DRUGS[id].adverseEventSignals] };
}
