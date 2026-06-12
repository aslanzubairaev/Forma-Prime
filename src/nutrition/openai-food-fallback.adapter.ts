import type { SupportedLanguage } from "../i18n/index.js";
import { extractOpenAiResponseText } from "../meals/openai-food-draft.adapter.js";
import type { StructuredFoodFallbackAdapter } from "./food-fallback-resolver.js";

type OpenAiFoodFallbackConfig = {
  apiKey?: string | undefined;
  model: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

const openAiResponsesUrl = "https://api.openai.com/v1/responses";
const defaultTimeoutMs = 8_000;

export function createOpenAiFoodFallbackAdapter(
  config: OpenAiFoodFallbackConfig,
): StructuredFoodFallbackAdapter {
  return {
    async resolveFood(rawText: string, language: SupportedLanguage) {
      if (!config.apiKey) {
        return {
          status: "unavailable",
        };
      }

      try {
        const response = await fetchOpenAiFoodFallback(config, rawText, language);

        if (!response.ok) {
          console.warn("OpenAI food fallback failed", {
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

        return {
          status: "parsed",
          value: JSON.parse(responseText) as unknown,
        };
      } catch {
        console.warn("OpenAI food fallback failed");
        return {
          status: "failed",
        };
      }
    },
  };
}

async function fetchOpenAiFoodFallback(
  config: OpenAiFoodFallbackConfig,
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
        buildOpenAiFoodFallbackRequest(config.model, rawText, language),
      ),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildOpenAiFoodFallbackRequest(
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
              "Resolve one food logging input into structured nutrition data.",
              "Return a conservative generic estimate only when the text is clearly a food or drink.",
              "Do not provide medical advice, coaching, prose, markdown, or multiple options.",
              "If the food is ambiguous or not clearly food, set needsClarification=true.",
              "Values must be per 100g. servingGrams should be the likely serving for unitless input, or null if not inferable.",
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
        name: "food_fallback",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            canonicalName: {
              type: "string",
            },
            displayName: {
              type: "string",
            },
            aliases: {
              type: "array",
              items: {
                type: "string",
              },
            },
            category: {
              type: ["string", "null"],
            },
            servingGrams: {
              type: ["number", "null"],
            },
            caloriesPer100g: {
              type: "number",
            },
            proteinPer100g: {
              type: "number",
            },
            fatPer100g: {
              type: "number",
            },
            carbsPer100g: {
              type: "number",
            },
            confidence: {
              type: "number",
            },
            isEstimate: {
              type: "boolean",
            },
            needsClarification: {
              type: "boolean",
            },
          },
          required: [
            "canonicalName",
            "displayName",
            "aliases",
            "category",
            "servingGrams",
            "caloriesPer100g",
            "proteinPer100g",
            "fatPer100g",
            "carbsPer100g",
            "confidence",
            "isEstimate",
            "needsClarification",
          ],
        },
      },
    },
    max_output_tokens: 600,
  };
}
