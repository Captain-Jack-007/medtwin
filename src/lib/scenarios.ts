// Fixed, deterministic demo scenarios A-D (PRD §22).
import { runTriage } from "./triage";
import { PatientInfo, ScreeningSession, SynthPatient } from "./types";

interface ScenarioDef {
  key: string;
  title: string;
  info: Omit<PatientInfo, "consent" | "createdAt">;
  session: Omit<ScreeningSession, "patientId">;
}

const DEFS: ScenarioDef[] = [
  {
    key: "A",
    title: "Normal screening",
    info: { id: "MT-A01", ageRange: "30-44", sex: "F", location: "v-a", symptoms: [] },
    session: {
      heartRate: 74, respiratoryRate: 15, faceSymmetry: true, armSymmetry: true,
      speechResult: true, signalQuality: "GOOD", systolic: 118, diastolic: 76, spo2: 98,
    },
  },
  {
    key: "B",
    title: "Cardiovascular warning",
    info: { id: "MT-014", ageRange: "60-74", sex: "M", location: "v-c", symptoms: ["Chest discomfort", "Shortness of breath"] },
    session: {
      heartRate: 112, respiratoryRate: 22, faceSymmetry: true, armSymmetry: true,
      speechResult: true, signalQuality: "GOOD", systolic: 168, diastolic: 102, spo2: 91,
    },
  },
  {
    key: "C",
    title: "Neurological warning",
    info: { id: "MT-051", ageRange: "45-59", sex: "F", location: "v-c", symptoms: ["Numbness in arm", "Severe headache"] },
    session: {
      heartRate: 88, respiratoryRate: 17, faceSymmetry: false, armSymmetry: false,
      speechResult: false, signalQuality: "GOOD", systolic: 146, diastolic: 92, spo2: 97,
    },
  },
  {
    key: "D",
    title: "Respiratory warning",
    info: { id: "MT-077", ageRange: "45-59", sex: "M", location: "v-i", symptoms: ["Shortness of breath", "Persistent cough"] },
    session: {
      heartRate: 98, respiratoryRate: 27, faceSymmetry: true, armSymmetry: true,
      speechResult: true, signalQuality: "FAIR", systolic: 134, diastolic: 86, spo2: 90,
    },
  },
  {
    key: "PHARMA",
    title: "Pharmaceutical intelligence demonstration",
    info: { id: "MT-1042", ageRange: "60-74", sex: "M", location: "v-i", symptoms: ["Fatigue"] },
    session: {
      heartRate: 86, respiratoryRate: 17, faceSymmetry: true, armSymmetry: true,
      speechResult: true, signalQuality: "GOOD", systolic: 136, diastolic: 84, spo2: 96,
    },
  },
];

export function getScenario(key: string): SynthPatient | undefined {
  const def = DEFS.find((d) => d.key.toLowerCase() === key.toLowerCase() || d.info.id === key);
  if (!def) return undefined;
  return buildScenario(def);
}

export function allScenarios(): SynthPatient[] {
  return DEFS.map(buildScenario);
}

function buildScenario(def: ScenarioDef): SynthPatient {
  const info: PatientInfo = {
    ...def.info,
    consent: true,
    createdAt: new Date(Date.UTC(2026, 7, 10, 22, 14)).toISOString(),
  };
  const session: ScreeningSession = { patientId: def.info.id, ...def.session };
  const triage = runTriage(session, def.info.symptoms);
  return { info, session, triage };
}
