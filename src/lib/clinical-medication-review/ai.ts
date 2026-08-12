import type { RealScanResult } from "@/lib/measurements/types";
import type { TriageResult } from "@/lib/types";
import type { ClinicianMedicationContext } from "./types";

export async function generateClinicianMedicationReviewDraft(input: {
  result: RealScanResult;
  triage: TriageResult;
  context: ClinicianMedicationContext;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("MedTwin AI provider is unavailable");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 420,
      temperature: 0.1,
      system: "You are MedTwin's clinician-only medication review assistant. You receive a smartphone screening result plus clinician-entered medication safety context. Create a concise clinical-review draft, not a prescription. Never give a dose, duration, administration instruction, or certainty. Never claim a diagnosis. Do not propose medication solely because of a screening signal. If the supplied evidence is not sufficient to support a medication proposal, say exactly that and name the information or assessment needed. If it is sufficient, label every named medicine as a potential clinician-review option that requires independent human approval and verification against the local licensed medicine database and protocol. Explain evidence and contraindication checks. Do not address the patient directly.",
      messages: [{ role: "user", content: JSON.stringify({ screeningResult: input.result, deterministicTriage: input.triage, clinicianMedicationContext: input.context }) }],
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`MedTwin AI provider returned ${response.status}`);
  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = payload.content?.find((block) => block.type === "text")?.text?.trim();
  if (!text || text.length > 2_600) throw new Error("MedTwin AI provider returned an invalid response");
  return text;
}
