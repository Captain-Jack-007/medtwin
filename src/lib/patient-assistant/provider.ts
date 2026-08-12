import { buildPatientAssistantSystemPrompt } from "./systemPrompt";
import type {
  PatientAssistantRequest,
  PatientAssistantResponse,
} from "./types";

export interface PatientAssistantProvider {
  readonly name: string;
  generate(input: PatientAssistantRequest): Promise<unknown>;
}

export function getConfiguredPatientAssistantProvider(): PatientAssistantProvider | null {
  const apiKey = process.env.MEDTWIN_ASSISTANT_API_KEY;
  const baseUrl = process.env.MEDTWIN_ASSISTANT_BASE_URL;
  const model = process.env.MEDTWIN_ASSISTANT_MODEL;
  if (apiKey && baseUrl && model) {
    return new OpenAICompatiblePatientAssistantProvider({ apiKey, baseUrl, model });
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) return null;
  return new AnthropicPatientAssistantProvider({
    apiKey: anthropicApiKey,
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
  });
}

export class OpenAICompatiblePatientAssistantProvider
  implements PatientAssistantProvider
{
  readonly name: string;

  constructor(
    private readonly config: {
      apiKey: string;
      baseUrl: string;
      model: string;
    }
  ) {
    this.name = `openai-compatible:${config.model}`;
  }

  async generate(input: PatientAssistantRequest): Promise<unknown> {
    const response = await fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: buildPatientAssistantSystemPrompt(
                input.context,
                input.language
              ),
            },
            ...input.conversation,
            { role: "user", content: input.message },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) {
      throw new Error(`Assistant provider returned ${response.status}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Assistant provider returned no content");
    return JSON.parse(content) as PatientAssistantResponse;
  }
}

/** Uses the shared, server-only MedTwin Claude configuration. */
export class AnthropicPatientAssistantProvider implements PatientAssistantProvider {
  readonly name: string;

  constructor(
    private readonly config: { apiKey: string; model: string }
  ) {
    this.name = `anthropic:${config.model}`;
  }

  async generate(input: PatientAssistantRequest): Promise<unknown> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 420,
        temperature: 0.1,
        system: buildPatientAssistantSystemPrompt(input.context, input.language),
        messages: [
          ...input.conversation.map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
          })),
          { role: "user", content: input.message },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Anthropic assistant provider returned ${response.status}`);
    }
    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const content = payload.content?.find((block) => block.type === "text")?.text;
    if (!content) throw new Error("Anthropic assistant provider returned no content");
    return JSON.parse(content) as PatientAssistantResponse;
  }
}
