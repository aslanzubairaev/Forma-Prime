import type { SupportedLanguage } from "../i18n/index.js";
import type {
  FoodDraftParserAdapter,
  FoodDraftResult,
} from "./ai-food-draft.types.js";

type OpenAiFoodDraftParserConfig = {
  apiKey?: string | undefined;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const defaultTimeoutMs = 8_000;

export function createOpenAiFoodDraftParserAdapter(
  config: OpenAiFoodDraftParserConfig,
): FoodDraftParserAdapter {
  return {
    async parseFoodDraft(rawText: string, language: SupportedLanguage) {
      if (!config.apiKey) {
        return {
          status: "unavailable",
        };
      }

      try {
        const response = await fetchOpenAiFoodDraft(config, rawText, language);

        if (!response.ok) {
          console.warn("OpenAI food draft parsing failed", {
            status: response.status,
          });
          return {
            status: "failed",
          };
        }

        const responseBody = await response.json();
        const responseText = extractOpenAiResponseText(responseBody);

        if (!responseText) {
          return {
            status: "failed",
          };
        }

        return parseOpenAiFoodDraftResponse(responseText);
      } catch {
        console.warn("OpenAI food draft parsing failed");
        return {
          status: "failed",
        };
      }
    },
  };
}

export function extractOpenAiResponseText(responseBody: unknown): string | null {
  if (!isRecord(responseBody)) {
    return null;
  }

  if (typeof responseBody.output_text === "string") {
    return responseBody.output_text;
  }

  if (!Array.isArray(responseBody.output)) {
    return null;
  }

  for (const outputItem of responseBody.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (
        isRecord(contentItem) &&
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        return contentItem.text;
      }
    }
  }

  return null;
}

function parseOpenAiFoodDraftResponse(responseText: string): FoodDraftResult {
  const parsed: unknown = JSON.parse(responseText);

  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    return {
      status: "failed",
    };
  }

  return {
    status: "parsed",
    items: parsed.items,
  };
}

async function fetchOpenAiFoodDraft(
  config: OpenAiFoodDraftParserConfig,
  rawText: string,
  language: SupportedLanguage,
): Promise<Response> {
  const fetchFn = config.fetchFn ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? defaultTimeoutMs,
  );

  try {
    return await fetchFn(openAiResponsesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(
        buildOpenAiFoodDraftRequest(config.model, rawText, language),
      ),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAiFoodDraftRequest(
  model: string,
  rawText: string,
  language: SupportedLanguage,
) {
  return {
    model,
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: [
              "Extract food logging draft items only.",
              "Return only foods with explicit gram-like quantities.",
              "Allowed units: g, gr, gram, grams, г, гр, грамм, грамма, граммов.",
              "Do not infer piece, cup, spoon, serving, or unitless portions.",
              "Do not include calories, macros, database ids, coaching, or explanations.",
              "If no safe gram-based items exist, return an empty items array.",
            ].join(" "),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Language: ${language}\nFood text: ${rawText}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "food_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: {
                    type: "string",
                  },
                  quantity: {
                    type: "number",
                  },
                  unit: {
                    type: "string",
                  },
                },
                required: ["label", "quantity", "unit"],
              },
            },
          },
          required: ["items"],
        },
      },
    },
    max_output_tokens: 400,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
