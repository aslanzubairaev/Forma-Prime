import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FoodDraftResult } from "../src/meals/ai-food-draft.types.js";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const {
  createOpenAiFoodDraftParserAdapter,
  extractOpenAiResponseText,
} = await import("../src/meals/openai-food-draft.adapter.js");
const { normalizeFoodDraft } = await import(
  "../src/meals/ai-food-draft.service.js"
);

describe("OpenAI food draft adapter", () => {
  it("returns unavailable when API key is missing", async () => {
    const adapter = createOpenAiFoodDraftParserAdapter({
      apiKey: undefined,
      model: "test-model",
      fetchFn: async () => jsonResponse({ output_text: "{}" }),
    });

    const result = await adapter.parseFoodDraft("ate 250g rice", "en");

    assert.deepEqual(result, { status: "unavailable" });
  });

  it("maps structured provider response into draft items", async () => {
    let requestBody: any = null;
    const adapter = createOpenAiFoodDraftParserAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetchFn: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return jsonResponse({
          output_text: JSON.stringify({
            items: [
              {
                label: "rice",
                quantity: 250,
                unit: "g",
              },
            ],
          }),
        });
      },
    });

    const result = await adapter.parseFoodDraft("ate 250g rice", "en");

    assert.equal(result.status, "parsed");
    assert.deepEqual(result.status === "parsed" ? result.items : [], [
      {
        label: "rice",
        quantity: 250,
        unit: "g",
      },
    ]);
    assert.equal(requestBody.model, "test-model");
    assert.equal(requestBody.text.format.type, "json_schema");
  });

  it("returns failed for malformed provider response", async () => {
    const adapter = createOpenAiFoodDraftParserAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetchFn: async () => jsonResponse({ output_text: "not json" }),
    });

    const result = await adapter.parseFoodDraft("ate 250g rice", "en");

    assert.deepEqual(result, { status: "failed" });
  });

  it("returns failed for provider HTTP error", async () => {
    const adapter = createOpenAiFoodDraftParserAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetchFn: async () => jsonResponse({ error: "bad" }, false),
    });

    const result = await adapter.parseFoodDraft("ate 250g rice", "en");

    assert.deepEqual(result, { status: "failed" });
  });

  it("piece-based provider output is still rejected by normalization", async () => {
    const draft: FoodDraftResult = {
      status: "parsed",
      items: [
        {
          label: "eggs",
          quantity: 2,
          unit: "piece",
        },
      ],
    };

    const result = normalizeFoodDraft(draft);

    assert.equal(result.status, "empty");
    assert.equal(result.items.length, 0);
  });

  it("Russian gram-like provider output survives normalization", () => {
    const draft: FoodDraftResult = {
      status: "parsed",
      items: [
        {
          label: "рис",
          quantity: 200,
          unit: "грамм",
        },
      ],
    };

    const result = normalizeFoodDraft(draft);

    assert.equal(result.status, "ok");
    assert.equal(result.items[0]?.unit, "g");
    assert.equal(result.items[0]?.grams, 200);
  });

  it("extracts response text from output content fallback shape", () => {
    const text = extractOpenAiResponseText({
      output: [
        {
          content: [
            {
              type: "output_text",
              text: "{\"items\":[]}",
            },
          ],
        },
      ],
    });

    assert.equal(text, "{\"items\":[]}");
  });
});

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}
