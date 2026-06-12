import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeFoodText } from "../src/nutrition/food-normalization.js";
import {
  buildLearnedFoodCandidateCreateData,
  learnedFoodCandidateToNutritionFoodRecord,
  type LearnedFoodCandidateRecord,
} from "../src/nutrition/learned-food.repository.js";
import {
  resolveFoodFallback,
  resolveParsedFoodItemWithFallback,
  type StructuredFoodFallbackAdapter,
} from "../src/nutrition/food-fallback-resolver.js";
import type {
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "../src/nutrition/food.types.js";

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
      alias: "риса",
      languageCode: "ru",
      normalizedAlias: "риса",
    },
  ],
};

describe("learned food fallback resolver", () => {
  it("keeps deterministic catalog resolution before learned or OpenAI fallback", async () => {
    let fallbackCalls = 0;
    const parsed = candidateFor("риса", 200);
    const result = await resolveParsedFoodItemWithFallback({
      item: parsed,
      foods: [rice],
      userId: "user_1",
      language: "ru",
      fallbackResolver: async () => {
        fallbackCalls += 1;
        return { status: "not_found" };
      },
    });

    assert.equal(result.status, "matched");
    assert.equal(result.status === "matched" ? result.source : "", "deterministic");
    assert.equal(fallbackCalls, 0);
  });

  it("resolves learned exact normalized input before OpenAI", async () => {
    let openAiCalls = 0;
    const learned = learnedRecord({
      id: "learned_1",
      rawInput: "хинкали",
      normalizedInput: "хинкали",
      canonicalName: "khinkali",
      displayName: "Хинкали",
      servingGrams: 250,
      aliasesJson: ["хинкалии"],
    });
    const result = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "хинкали",
      language: "ru",
      learnedRepository: {
        findMatch: async () => learned,
        incrementTimesSeen: async () => learned,
        saveOpenAiResult: async () => {
          throw new Error("should not save on learned hit");
        },
      },
      adapter: adapterFrom(async () => {
        openAiCalls += 1;
        return { status: "unavailable" };
      }),
    });

    assert.equal(result.status, "resolved");
    assert.equal(result.status === "resolved" ? result.source : "", "learned");
    assert.equal(result.status === "resolved" ? result.food.slug : "", "learned-learned_1");
    assert.equal(result.status === "resolved" ? result.parsedItem.grams : 0, 250);
    assert.equal(openAiCalls, 0);
  });

  it("calls OpenAI for unknown food, validates, saves learned memory, and returns estimate", async () => {
    const savedInputs: string[] = [];
    const result = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "сырный раф",
      language: "ru",
      learnedRepository: {
        findMatch: async () => null,
        incrementTimesSeen: async (record) => record,
        saveOpenAiResult: async (input) => {
          savedInputs.push(input.normalizedInput);
          return learnedRecord({
            id: "learned_raf",
            rawInput: input.rawInput,
            normalizedInput: input.normalizedInput,
            canonicalName: input.fallback.canonicalName,
            displayName: input.fallback.displayName,
            category: input.fallback.category,
            servingGrams: input.fallback.servingGrams,
            caloriesPer100g: input.fallback.caloriesPer100g,
            proteinPer100g: input.fallback.proteinPer100g,
            fatPer100g: input.fallback.fatPer100g,
            carbsPer100g: input.fallback.carbsPer100g,
            confidence: input.fallback.confidence,
            isEstimate: input.fallback.isEstimate,
            aliasesJson: input.fallback.aliases,
          });
        },
      },
      adapter: adapterFrom(async () => ({
        status: "parsed",
        value: {
          canonicalName: "cheese raf coffee",
          displayName: "Сырный раф",
          aliases: ["сырный раф", "раф сырный"],
          category: "drink",
          servingGrams: 300,
          caloriesPer100g: 115,
          proteinPer100g: 3,
          fatPer100g: 6,
          carbsPer100g: 12,
          confidence: 0.82,
          isEstimate: true,
          needsClarification: false,
        },
      })),
    });

    assert.equal(result.status, "resolved");
    assert.deepEqual(savedInputs, ["сырный раф"]);
    assert.equal(result.status === "resolved" ? result.source : "", "openai");
    assert.equal(result.status === "resolved" ? result.food.isLearned : false, true);
    assert.equal(result.status === "resolved" ? result.parsedItem.isEstimate : false, true);
    assert.equal(result.status === "resolved" ? result.parsedItem.grams : 0, 300);
  });

  it("reuses a newly learned input on the next same phrase without another OpenAI call", async () => {
    let openAiCalls = 0;
    let stored: LearnedFoodCandidateRecord | null = null;
    const repository = {
      findMatch: async (_userId: string, normalizedInput: string) =>
        stored?.normalizedInput === normalizedInput ? stored : null,
      incrementTimesSeen: async (record: LearnedFoodCandidateRecord) => ({
        ...record,
        timesSeen: record.timesSeen + 1,
      }),
      saveOpenAiResult: async (input: Parameters<
        NonNullable<Parameters<typeof resolveFoodFallback>[0]["learnedRepository"]>["saveOpenAiResult"]
      >[0]) => {
        stored = learnedRecord({
          id: "learned_2",
          rawInput: input.rawInput,
          normalizedInput: input.normalizedInput,
          canonicalName: input.fallback.canonicalName,
          displayName: input.fallback.displayName,
          servingGrams: input.fallback.servingGrams,
          caloriesPer100g: input.fallback.caloriesPer100g,
          proteinPer100g: input.fallback.proteinPer100g,
          fatPer100g: input.fallback.fatPer100g,
          carbsPer100g: input.fallback.carbsPer100g,
          confidence: input.fallback.confidence,
          isEstimate: input.fallback.isEstimate,
          aliasesJson: input.fallback.aliases,
        });
        return stored;
      },
    };
    const adapter = adapterFrom(async () => {
      openAiCalls += 1;
      return {
        status: "parsed",
        value: {
          canonicalName: "protein cheesecake",
          displayName: "Протеиновый чизкейк",
          aliases: ["протеиновый чизкейк"],
          category: "dessert",
          servingGrams: 180,
          caloriesPer100g: 210,
          proteinPer100g: 18,
          fatPer100g: 8,
          carbsPer100g: 16,
          confidence: 0.86,
          isEstimate: true,
          needsClarification: false,
        },
      };
    });

    const first = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "протеиновый чизкейк",
      language: "ru",
      learnedRepository: repository,
      adapter,
    });
    const second = await resolveFoodFallback({
      userId: "user_1",
      rawInput: "протеиновый чизкейк",
      language: "ru",
      learnedRepository: repository,
      adapter,
    });

    assert.equal(first.status, "resolved");
    assert.equal(second.status, "resolved");
    assert.equal(second.status === "resolved" ? second.source : "", "learned");
    assert.equal(openAiCalls, 1);
  });

  it("fails safely for invalid, clarifying, or low-confidence OpenAI output", async () => {
    const cases: StructuredFoodFallbackAdapter[] = [
      adapterFrom(async () => ({ status: "failed" })),
      adapterFrom(async () => ({
        status: "parsed",
        value: {
          canonicalName: "unknown",
          displayName: "Unknown",
          aliases: [],
          category: "unknown",
          servingGrams: 100,
          caloriesPer100g: 100,
          proteinPer100g: 1,
          fatPer100g: 1,
          carbsPer100g: 1,
          confidence: 0.4,
          isEstimate: true,
          needsClarification: false,
        },
      })),
      adapterFrom(async () => ({
        status: "parsed",
        value: {
          canonicalName: "coffee",
          displayName: "Coffee",
          aliases: ["кофе"],
          category: "drink",
          servingGrams: 200,
          caloriesPer100g: 2,
          proteinPer100g: 0,
          fatPer100g: 0,
          carbsPer100g: 0,
          confidence: 0.9,
          isEstimate: true,
          needsClarification: true,
        },
      })),
    ];

    for (const adapter of cases) {
      const result = await resolveFoodFallback({
        userId: "user_1",
        rawInput: "непонятная штука",
        language: "ru",
        learnedRepository: emptyRepository(),
        adapter,
      });

      assert.equal(result.status, "not_found");
    }
  });

  it("keeps learned data separate from the core catalog record shape", () => {
    const learned = learnedRecord({
      id: "learned_3",
      canonicalName: "khachapuri",
      displayName: "Хачапури",
      normalizedInput: "хачапури",
      aliasesJson: ["лодочка"],
    });
    const record = learnedFoodCandidateToNutritionFoodRecord(learned);

    assert.equal(record.isLearned, true);
    assert.equal(record.isCustom, undefined);
    assert.equal(record.slug, "learned-learned_3");
    assert.equal(record.aliases.some((alias) => alias.normalizedAlias === "лодочка"), true);
  });

  it("builds normalized learned create data for persistence", () => {
    const data = buildLearnedFoodCandidateCreateData({
      userId: "user_1",
      rawInput: "  Сырный раф  ",
      fallback: {
        canonicalName: "cheese raf coffee",
        displayName: "Сырный раф",
        aliases: ["раф сырный"],
        category: "drink",
        servingGrams: 300,
        caloriesPer100g: 115,
        proteinPer100g: 3,
        fatPer100g: 6,
        carbsPer100g: 12,
        confidence: 0.82,
        isEstimate: true,
        needsClarification: false,
      },
    });

    assert.equal(data.normalizedInput, normalizeFoodText("Сырный раф"));
    assert.equal(data.source, "openai_fallback");
    assert.equal(data.isEstimate, true);
    assert.equal(data.timesSeen, 1);
  });
});

function candidateFor(label: string, grams: number): ParsedFoodItemCandidate {
  return {
    rawLabel: label,
    normalizedLabel: normalizeFoodText(label),
    quantity: grams,
    unit: "g",
    grams,
  };
}

function adapterFrom(
  resolve: StructuredFoodFallbackAdapter["resolveFood"],
): StructuredFoodFallbackAdapter {
  return {
    resolveFood: resolve,
  };
}

function emptyRepository() {
  return {
    findMatch: async () => null,
    incrementTimesSeen: async (record: LearnedFoodCandidateRecord) => record,
    saveOpenAiResult: async () => {
      throw new Error("should not save");
    },
  };
}

function learnedRecord(
  input: Partial<LearnedFoodCandidateRecord>,
): LearnedFoodCandidateRecord {
  return {
    id: input.id ?? "learned_1",
    userId: input.userId ?? "user_1",
    rawInput: input.rawInput ?? "хинкали",
    normalizedInput: input.normalizedInput ?? "хинкали",
    canonicalName: input.canonicalName ?? "khinkali",
    displayName: input.displayName ?? "Хинкали",
    category: input.category ?? "meal",
    servingGrams: input.servingGrams ?? 250,
    caloriesPer100g: input.caloriesPer100g ?? 235,
    proteinPer100g: input.proteinPer100g ?? 10,
    fatPer100g: input.fatPer100g ?? 9,
    carbsPer100g: input.carbsPer100g ?? 28,
    confidence: input.confidence ?? 0.82,
    isEstimate: input.isEstimate ?? true,
    aliasesJson: input.aliasesJson ?? [],
    source: input.source ?? "openai_fallback",
    timesSeen: input.timesSeen ?? 1,
    createdAt: input.createdAt ?? new Date("2026-06-12T00:00:00.000Z"),
    updatedAt: input.updatedAt ?? new Date("2026-06-12T00:00:00.000Z"),
    approvedAt: input.approvedAt ?? null,
    rejectedAt: input.rejectedAt ?? null,
  };
}
