import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createOpenAiFoodFallbackAdapter } from "../src/nutrition/openai-food-fallback.adapter.js";

describe("OpenAI learned food fallback adapter", () => {
  it("returns unavailable when API key is missing", async () => {
    const adapter = createOpenAiFoodFallbackAdapter({
      apiKey: undefined,
      model: "test-model",
      fetchFn: async () => {
        throw new Error("should not fetch without key");
      },
    });

    const result = await adapter.resolveFood("сырный раф", "ru");

    assert.deepEqual(result, { status: "unavailable" });
  });

  it("returns structured provider JSON as parsed value", async () => {
    const adapter = createOpenAiFoodFallbackAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              canonicalName: "cheese raf coffee",
              displayName: "Сырный раф",
              aliases: ["сырный раф"],
              category: "drink",
              servingGrams: 300,
              caloriesPer100g: 115,
              proteinPer100g: 3,
              fatPer100g: 6,
              carbsPer100g: 12,
              confidence: 0.82,
              isEstimate: true,
              needsClarification: false,
            }),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
    });

    const result = await adapter.resolveFood("сырный раф", "ru");

    assert.equal(result.status, "parsed");
    assert.equal(
      result.status === "parsed" ? (result.value as any).displayName : "",
      "Сырный раф",
    );
  });

  it("returns failed for malformed provider JSON", async () => {
    const adapter = createOpenAiFoodFallbackAdapter({
      apiKey: "test-key",
      model: "test-model",
      fetchFn: async () =>
        new Response(JSON.stringify({ output_text: "not-json" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
    });

    const result = await adapter.resolveFood("сырный раф", "ru");

    assert.deepEqual(result, { status: "failed" });
  });
});
