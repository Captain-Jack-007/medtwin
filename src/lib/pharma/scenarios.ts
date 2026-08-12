import { medication } from "./synthetic-drugs";
import type { PharmaScenario } from "./types";

const plan = (id: string, name: string, medications: ReturnType<typeof medication>[], interventions: string[]) => ({ id, name, medications, interventions });

export const PHARMA_SCENARIOS: PharmaScenario[] = [
  { id: "anticoagulant-nsaid", title: "Anticoagulant + NSAID signal", patientId: "MT-1042", context: { medications: [medication("warfarin"), medication("ibuprofen"), medication("lisinopril"), medication("atorvastatin")], allergies: [], kidneyStatus: "HIGH", liverStatus: "LOW", age: 68, syntheticConditions: ["Synthetic bleeding-risk marker", "Synthetic CKD 3a marker", "Synthetic hypertension marker", "Synthetic osteoarthritis marker"], syntheticLabFlags: ["warfarin dose monitoring flag"] }, patientProfile: { age: 68, heightCm: 172, weightKg: 78, conditions: ["atrial_fibrillation", "ckd_stage_3a", "hypertension", "osteoarthritis"], kidneyEstimate: "eGFR 48", cardiovascularSummary: "AF", bleedingRisk: "HIGH" }, medicineCandidates: [
    { id: "apixaban", medication: medication("apixaban"), replacesMedicationIds: ["warfarin", "ibuprofen"] },
    { id: "acetaminophen", medication: medication("acetaminophen"), replacesMedicationIds: ["ibuprofen"] },
    { id: "dabigatran", medication: medication("dabigatran"), replacesMedicationIds: ["warfarin", "ibuprofen"] },
    { id: "rivaroxaban", medication: medication("rivaroxaban"), replacesMedicationIds: ["warfarin", "ibuprofen"] },
    { id: "ibuprofen", medication: medication("ibuprofen"), replacesMedicationIds: [] },
    { id: "warfarin", medication: medication("warfarin"), replacesMedicationIds: [] },
    { id: "aspirin", medication: medication("aspirin"), replacesMedicationIds: [] },
    { id: "diclofenac", medication: medication("diclofenac"), replacesMedicationIds: ["ibuprofen"] },
    { id: "naproxen", medication: medication("naproxen"), replacesMedicationIds: ["ibuprofen"] },
    { id: "meloxicam", medication: medication("meloxicam"), replacesMedicationIds: ["ibuprofen"] },
    { id: "amlodipine", medication: medication("amlodipine"), replacesMedicationIds: ["lisinopril"] },
    { id: "bisoprolol", medication: medication("bisoprolol"), replacesMedicationIds: [] },
    { id: "losartan", medication: medication("losartan"), replacesMedicationIds: ["lisinopril"] },
    { id: "hydrochlorothiazide", medication: medication("hydrochlorothiazide"), replacesMedicationIds: [] },
    { id: "furosemide", medication: medication("furosemide"), replacesMedicationIds: [] },
    { id: "omeprazole", medication: medication("omeprazole"), replacesMedicationIds: [] },
    { id: "pantoprazole", medication: medication("pantoprazole"), replacesMedicationIds: [] },
  ], plans: [plan("current", "Current simulated plan", [medication("warfarin"), medication("ibuprofen"), medication("lisinopril"), medication("atorvastatin")], ["Baseline synthetic configuration"]), plan("alternative-a", "Alternative A · reduced signals", [medication("warfarin"), medication("acetaminophen"), medication("lisinopril")], ["NSAID removed in simulation"]), plan("alternative-b", "Alternative B · lower simulated risk", [medication("acetaminophen"), medication("lisinopril")], ["Anticoagulant and NSAID absent in simulation"]) ] },
  { id: "renal-accumulation", title: "Reduced kidney function + accumulation signal", patientId: "MT-014", context: { medications: [medication("metformin"), medication("lisinopril"), medication("ibuprofen")], allergies: [], kidneyStatus: "HIGH", liverStatus: "LOW", age: 71, syntheticConditions: ["Reduced synthetic kidney function"], syntheticLabFlags: ["metformin dose monitoring flag"] }, plans: [plan("current", "Current simulated plan", [medication("metformin"), medication("lisinopril"), medication("ibuprofen")], ["Baseline synthetic configuration"]), plan("alternative-a", "Alternative A · reduced signals", [medication("metformin"), medication("lisinopril")], ["NSAID removed in simulation"]), plan("alternative-b", "Alternative B · lower simulated risk", [medication("acetaminophen"), medication("lisinopril")], ["Accumulation-sensitive agent absent in simulation"]) ] },
  { id: "polypharmacy", title: "Multiple-medication signal", patientId: "MT-077", context: { medications: [medication("warfarin"), medication("ibuprofen"), medication("lisinopril"), medication("spironolactone"), medication("atorvastatin")], allergies: [], kidneyStatus: "MODERATE", liverStatus: "MODERATE", age: 76, syntheticConditions: ["Synthetic polypharmacy marker"], syntheticLabFlags: [] }, plans: [plan("current", "Current simulated plan", [medication("warfarin"), medication("ibuprofen"), medication("lisinopril"), medication("spironolactone"), medication("atorvastatin")], ["Baseline synthetic configuration"]), plan("alternative-a", "Alternative A · reduced signals", [medication("warfarin"), medication("acetaminophen"), medication("lisinopril"), medication("atorvastatin")], ["NSAID and diuretic removed in simulation"]), plan("alternative-b", "Alternative B · lower simulated risk", [medication("acetaminophen"), medication("lisinopril"), medication("atorvastatin")], ["High-interaction medicines absent in simulation"]) ] },
];

export function getPharmaScenario(patientId: string): PharmaScenario { return PHARMA_SCENARIOS.find((scenario) => scenario.patientId === patientId) ?? PHARMA_SCENARIOS[2]; }
