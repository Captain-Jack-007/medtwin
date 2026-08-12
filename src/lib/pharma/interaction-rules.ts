import type { DrugInteraction } from "./types";

export const INTERACTION_RULES: DrugInteraction[] = [
  { medications: ["warfarin", "ibuprofen"], severity: "CRITICAL", type: "bleeding", explanationKey: "warfarin_nsaid", summary: "Potential elevated bleeding-risk signal from concurrent anticoagulant and NSAID." },
  { medications: ["lisinopril", "ibuprofen"], severity: "HIGH", type: "renal", explanationKey: "acei_nsaid", summary: "Potential renal-burden signal in this synthetic combination." },
  { medications: ["lisinopril", "spironolactone"], severity: "HIGH", type: "metabolic", explanationKey: "acei_spiro", summary: "Potential electrolyte and renal monitoring signal in this synthetic combination." },
  { medications: ["atorvastatin", "warfarin"], severity: "MODERATE", type: "bleeding", explanationKey: "statin_warfarin", summary: "Potential medication-monitoring signal in this synthetic combination." },
  { medications: ["warfarin", "aspirin"], severity: "CRITICAL", type: "bleeding", explanationKey: "warfarin_aspirin", summary: "Potential elevated bleeding-risk signal in this synthetic anticoagulant and antiplatelet combination." },
  { medications: ["warfarin", "diclofenac"], severity: "CRITICAL", type: "bleeding", explanationKey: "warfarin_diclofenac", summary: "Potential elevated bleeding-risk signal in this synthetic anticoagulant and NSAID combination." },
  { medications: ["warfarin", "naproxen"], severity: "CRITICAL", type: "bleeding", explanationKey: "warfarin_naproxen", summary: "Potential elevated bleeding-risk signal in this synthetic anticoagulant and NSAID combination." },
  { medications: ["warfarin", "meloxicam"], severity: "HIGH", type: "bleeding", explanationKey: "warfarin_meloxicam", summary: "Potential bleeding-monitoring signal in this synthetic anticoagulant and NSAID combination." },
  { medications: ["lisinopril", "diclofenac"], severity: "HIGH", type: "renal", explanationKey: "acei_diclofenac", summary: "Potential renal-burden signal in this synthetic cardiovascular agent and NSAID combination." },
  { medications: ["lisinopril", "naproxen"], severity: "HIGH", type: "renal", explanationKey: "acei_naproxen", summary: "Potential renal-burden signal in this synthetic cardiovascular agent and NSAID combination." },
  { medications: ["lisinopril", "meloxicam"], severity: "HIGH", type: "renal", explanationKey: "acei_meloxicam", summary: "Potential renal-burden signal in this synthetic cardiovascular agent and NSAID combination." },
];
