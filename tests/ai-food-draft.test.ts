import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchFoodCandidate } from "../src/nutrition/food-matcher.js";
import type { NutritionFoodRecord } from "../src/nutrition/food.types.js";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const {
  normalizeFoodDraft,
  parseFoodDraft,
} = await import("../src/meals/ai-food-draft.service.js");

const chickenBreast: NutritionFoodRecord = {
  id: "food_chicken_breast",
  slug: "chicken-breast-cooked-skinless",
  nameRu: "Куриная грудка",
  nameEn: "Chicken breast, cooked, skinless",
  caloriesPer100g: 165,
  proteinPer100g: 31,
  fatPer100g: 3.6,
  carbsPer100g: 0,
  aliases: [
    {
      alias: "chicken breast",
      languageCode: "en",
      normalizedAlias: "chicken breast",
    },
  ],
};

const chickenThigh: NutritionFoodRecord = {
  id: "food_chicken_thigh",
  slug: "chicken-thigh-cooked-skinless",
  nameRu: "Куриное бедро",
  nameEn: "Chicken thigh, cooked, skinless",
  caloriesPer100g: 209,
  proteinPer100g: 26,
  fatPer100g: 10.9,
  carbsPer100g: 0,
  aliases: [
    {
      alias: "chicken thigh",
      languageCode: "en",
      normalizedAlias: "chicken thigh",
    },
  ],
};

const rice: NutritionFoodRecord = {
  id: "food_rice",
  slug: "white-rice-cooked",
  nameRu: "Рис белый, вареный",
  nameEn: "White rice, cooked",
  caloriesPer100g: 130,
  proteinPer100g: 2.38,
  fatPer100g: 0.21,
  carbsPer100g: 28.59,
  aliases: [
    {
      alias: "rice",
      languageCode: "en",
      normalizedAlias: "rice",
    },
  ],
};

describe("AI food draft normalization", () => {
  it("normalizes a valid gram draft into deterministic candidates", () => {
    const result = normalizeFoodDraft({
      status: "parsed",
      items: [
        {
          label: "chicken breast",
          quantity: 200,
          unit: "g",
        },
      ],
    });

    assert.equal(result.status, "ok");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.rawLabel, "chicken breast");
    assert.equal(result.items[0]?.grams, 200);
  });

  it("rejects invalid draft items", () => {
    const result = normalizeFoodDraft({
      status: "parsed",
      items: [
        {
          label: "",
          quantity: 200,
          unit: "g",
        },
        {
          label: "rice",
          quantity: -1,
          unit: "g",
        },
        {
          label: "egg",
          quantity: 2,
          unit: "piece",
        },
      ],
    });

    assert.equal(result.status, "empty");
    assert.equal(result.items.length, 0);
  });

  it("handles empty draft safely", () => {
    const result = normalizeFoodDraft({
      status: "parsed",
      items: [],
    });

    assert.equal(result.status, "empty");
    assert.equal(result.items.length, 0);
  });

  it("does not trust calories or macro fields from AI output", () => {
    const result = normalizeFoodDraft({
      status: "parsed",
      items: [
        {
          label: "rice",
          quantity: 150,
          unit: "grams",
          calories: 9999,
          proteinG: 999,
        },
      ],
    });

    assert.equal(result.status, "ok");
    assert.deepEqual(Object.keys(result.items[0] ?? {}).sort(), [
      "grams",
      "normalizedLabel",
      "quantity",
      "rawLabel",
      "unit",
    ]);
  });
});

describe("AI draft deterministic integration", () => {
  it("AI draft candidates flow into the existing matcher", () => {
    const result = normalizeFoodDraft({
      status: "parsed",
      items: [
        {
          label: "rice",
          quantity: 250,
          unit: "g",
        },
      ],
    });

    assert.equal(result.status, "ok");

    const match = matchFoodCandidate(result.items[0]!, [rice]);

    assert.equal(match.status, "matched");
    assert.equal(match.status === "matched" ? match.food.id : "", "food_rice");
  });

  it("ambiguous AI draft candidates still trigger ambiguity", () => {
    const result = normalizeFoodDraft({
      status: "parsed",
      items: [
        {
          label: "chicken",
          quantity: 150,
          unit: "g",
        },
      ],
    });

    assert.equal(result.status, "ok");

    const match = matchFoodCandidate(result.items[0]!, [
      chickenBreast,
      chickenThigh,
    ]);

    assert.equal(match.status, "ambiguous");
  });

  it("unknown AI draft candidates still fail safely", () => {
    const result = normalizeFoodDraft({
      status: "parsed",
      items: [
        {
          label: "unknown food",
          quantity: 150,
          unit: "g",
        },
      ],
    });

    assert.equal(result.status, "ok");

    const match = matchFoodCandidate(result.items[0]!, [rice]);

    assert.equal(match.status, "not_found");
  });
});

describe("AI draft failure handling", () => {
  it("malformed adapter output does not crash", async () => {
    const result = await parseFoodDraft("ate 250g rice", "en", {
      parseFoodDraft: async () => ({
        status: "parsed",
        items: [{ label: "rice", quantity: "a lot", unit: "g" }],
      } as any),
    });

    assert.equal(result.status, "empty");
  });

  it("provider failure returns failed result", async () => {
    const result = await parseFoodDraft("ate 250g rice", "en", {
      parseFoodDraft: async () => {
        throw new Error("provider unavailable");
      },
    });

    assert.equal(result.status, "failed");
  });

  it("timeout-like failure returns failed result", async () => {
    const result = await parseFoodDraft("ate 250g rice", "en", {
      parseFoodDraft: async () => {
        throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      },
    });

    assert.equal(result.status, "failed");
  });
});
