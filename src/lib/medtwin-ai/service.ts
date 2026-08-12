import { PHARMA_SCENARIOS } from "@/lib/pharma/scenarios";
import { assessPharmaceuticalRisk } from "@/lib/pharma/risk-engine";
import { simulateScenario } from "@/lib/pharma/treatment-simulator";
import { compareTreatmentPlans } from "@/lib/pharma/treatment-delta";
import { buildPharmaTwinState } from "@/lib/pharma/twin-state";
import { assessMedicineCandidates } from "@/lib/pharma/medicine-assessment";
import type { MedTwinAIRequest } from "./types";

export async function generateMedTwinAIExplanation(request: MedTwinAIRequest): Promise<string> {
  if (request.audience === "patient") {
    return generatePatientExplanation(request);
  }
  const scenario = PHARMA_SCENARIOS.find((item) => item.id === request.scenarioId);
  if (!scenario) throw new Error("Unknown synthetic scenario");
  const findings = assessPharmaceuticalRisk(scenario.context);
  const simulations = simulateScenario(scenario);
  const selectedFinding = [
    ...findings.interactions, ...findings.doseConcerns, ...findings.organWarnings, ...findings.allergyWarnings, ...findings.adverseEventSignals,
  ].find((finding) => finding.id === request.selectedFindingId) ?? findings.priorityFinding;
  const currentTreatment = simulations[0];
  const selectedPlan = simulations.find((simulation) => simulation.plan.id === request.selectedPlanId) ?? currentTreatment;
  const candidateAssessment = request.candidateId
    ? assessMedicineCandidates(scenario).find((assessment) => assessment.medicineId === request.candidateId) ?? null
    : null;
  const treatmentDelta = compareTreatmentPlans(currentTreatment.plan, selectedPlan.plan, currentTreatment.result, selectedPlan.result);
  const twinState = buildPharmaTwinState(
    scenario,
    selectedPlan.plan,
    selectedPlan.result,
    selectedPlan.plan.id === currentTreatment.plan.id ? "current" : "simulated",
    selectedFinding?.relatedSystem
  );
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("MedTwin AI provider is unavailable");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 420,
      temperature: 0.1,
      system: "You are MedTwin Clinical Intelligence. Explain only the supplied synthetic simulation data. The deterministic current/alternative simulation results and treatmentDelta are authoritative. Do not invent or change measurements, diagnoses, doses, scores, risk classifications, outcomes, medication changes, or real-world clinical instructions. Never prescribe or recommend medication. Describe only potential/detected synthetic signals and call this a synthetic decision-support simulation. Be concise, calm, and clear.",
      messages: [{ role: "user", content: JSON.stringify({ audience: request.audience, requestType: request.requestType, question: request.question ?? null, patientSummary: { scenario: scenario.title, age: scenario.context.age, syntheticConditions: scenario.context.syntheticConditions }, pharmaceuticalFindings: findings, selectedFinding, candidateAssessment, treatmentSimulationResults: simulations.map(({ plan, result }) => ({ name: plan.name, result })), currentTreatment: { name: currentTreatment.plan.name, plan: currentTreatment.plan, simulation: currentTreatment.result }, alternativeTreatment: { name: selectedPlan.plan.name, plan: selectedPlan.plan, simulation: selectedPlan.result }, treatmentDelta, twinState }) }],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`MedTwin AI provider returned ${response.status}`);
  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = payload.content?.find((block) => block.type === "text")?.text?.trim();
  if (!text || text.length > 2600) throw new Error("MedTwin AI provider returned an invalid response");
  return text;
}

async function generatePatientExplanation(request: MedTwinAIRequest): Promise<string> {
  const context = request.patientContext;
  if (!context) throw new Error("Missing patient result context");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("MedTwin AI provider is unavailable");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 260,
      temperature: 0.1,
      system: "You are MedTwin Results Assistant for a patient-facing synthetic checkup. Explain only the supplied result summary and measurements in simple, calm language. Do not diagnose, prescribe, recommend drugs, discuss medication interactions or treatment simulations, invent measurements or certainty, or change result statuses. Explain that missing or device-required measurements are not abnormal findings by themselves. If supplied data contains a review signal, suggest professional review without urgency claims beyond the supplied summary.",
      messages: [{ role: "user", content: JSON.stringify({ audience: request.audience, question: request.question ?? null, resultSummary: context.resultSummary, measurements: context.measurements, detectedSignals: context.detectedSignals, unavailableMeasurements: context.unavailableMeasurements }) }],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`MedTwin AI provider returned ${response.status}`);
  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = payload.content?.find((block) => block.type === "text")?.text?.trim();
  if (!text || text.length > 1800) throw new Error("MedTwin AI provider returned an invalid response");
  return text;
}
