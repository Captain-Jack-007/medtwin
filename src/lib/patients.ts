// Synthetic patient generation + fixed demo scenarios A-D.
import { mulberry32, intBetween, pick } from "./rng";
import { VILLAGES } from "./region";
import { runTriage } from "./triage";
import {
  PatientInfo,
  ScreeningSession,
  SignalQuality,
  SynthPatient,
} from "./types";

const AGE_RANGES = ["18-29", "30-44", "45-59", "60-74", "75+"];
const SYMPTOM_POOL = [
  "Chest discomfort",
  "Shortness of breath",
  "Palpitations",
  "Dizziness",
  "Persistent cough",
  "Severe headache",
  "Numbness in arm",
  "Fatigue",
  "Fever",
];

function makeSession(
  rand: () => number,
  patientId: string,
  bias: "normal" | "cardio" | "neuro" | "resp"
): { session: ScreeningSession; symptoms: string[] } {
  const quality: SignalQuality = pick(rand, ["GOOD", "GOOD", "FAIR", "POOR"]);
  let hr = intBetween(rand, 62, 92);
  let rr = intBetween(rand, 12, 18);
  let face = true;
  let arm = true;
  let speech = true;
  let sys = intBetween(rand, 110, 132);
  let dia = intBetween(rand, 70, 84);
  let spo2 = intBetween(rand, 96, 99);
  const symptoms: string[] = [];

  if (bias === "cardio") {
    hr = intBetween(rand, 104, 126);
    sys = intBetween(rand, 150, 172);
    dia = intBetween(rand, 94, 106);
    spo2 = intBetween(rand, 91, 95);
    symptoms.push("Chest discomfort");
    if (rand() > 0.5) symptoms.push("Palpitations");
  } else if (bias === "neuro") {
    face = rand() > 0.4 ? false : true;
    arm = rand() > 0.5 ? false : true;
    speech = rand() > 0.6 ? false : true;
    symptoms.push("Numbness in arm");
  } else if (bias === "resp") {
    rr = intBetween(rand, 23, 28);
    spo2 = intBetween(rand, 89, 93);
    symptoms.push("Shortness of breath");
    if (rand() > 0.5) symptoms.push("Persistent cough");
  } else if (rand() > 0.7) {
    symptoms.push(pick(rand, SYMPTOM_POOL.slice(3)));
  }

  return {
    session: {
      patientId,
      heartRate: hr,
      respiratoryRate: rr,
      faceSymmetry: face,
      armSymmetry: arm,
      speechResult: speech,
      signalQuality: quality,
      systolic: sys,
      diastolic: dia,
      spo2,
    },
    symptoms,
  };
}

function buildPatient(
  rand: () => number,
  n: number,
  bias: "normal" | "cardio" | "neuro" | "resp"
): SynthPatient {
  const id = `MT-${String(n).padStart(3, "0")}`;
  const village = pick(rand, VILLAGES);
  const { session, symptoms } = makeSession(rand, id, bias);
  const info: PatientInfo = {
    id,
    ageRange: pick(rand, AGE_RANGES),
    sex: rand() > 0.5 ? "M" : "F",
    location: village.id,
    symptoms,
    consent: true,
    createdAt: new Date(Date.UTC(2026, 7, 10, 8, n % 60)).toISOString(),
  };
  const triage = runTriage(session, symptoms);
  return { info, session, triage };
}

// Deterministic population. Distribution is driven by rules, not forced,
// but bias weights approximate the PRD's 72/17/8/3 target.
export function generatePopulation(count = 240, seed = 20260810): SynthPatient[] {
  const rand = mulberry32(seed);
  const out: SynthPatient[] = [];
  for (let i = 1; i <= count; i++) {
    const r = rand();
    const bias =
      r < 0.05 ? "cardio" : r < 0.09 ? "resp" : r < 0.12 ? "neuro" : "normal";
    out.push(buildPatient(rand, i, bias));
  }
  return out;
}

let cache: SynthPatient[] | null = null;
export function getPopulation(): SynthPatient[] {
  if (!cache) cache = generatePopulation();
  return cache;
}
