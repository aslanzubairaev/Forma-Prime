import { z } from "zod";

import { env } from "../config/env.js";
import type { SupportedLanguage } from "../i18n/index.js";
import { matchFoodCandidate } from "./food-matcher.js";
import { normalizeFoodText } from "./food-normalization.js";
import type {
  FoodMatchResult,
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "./food.types.js";
import {
  findLearnedFoodCandidateMatch,
  incrementLearnedFoodTimesSeen,
  learnedFoodCandidateToNutritionFoodRecord,
  saveOpenAiLearnedFoodCandidate,
  type LearnedFoodCandidateRecord,
  type SaveOpenAiLearnedFoodInput,
  type StructuredLearnedFoodFallback,
} from "./learned-food.repository.js";
import { createOpenAiFoodFallbackAdapter } from "./openai-food-fallback.adapter.js";

export type StructuredFoodFallbackAdapter = {
  resolveFood(
    rawText: string,
    language: SupportedLanguage,
  ): Promise<
    | {
        status: "parsed";
        value: unknown;
      }
    | {
        status: "unavailable" | "failed";
      }
  >;
};

export type LearnedFoodRepository = {
  findMatch(
    userId: string,
    normalizedInput: string,
  ): Promise<LearnedFoodCandidateRecord | null>;
  incrementTimesSeen(
    record: LearnedFoodCandidateRecord,
  ): Promise<LearnedFoodCandidateRecord>;
  saveOpenAiResult(
    input: SaveOpenAiLearnedFoodInput,
  ): Promise<LearnedFoodCandidateRecord>;
};

export type FoodFallbackResolution =
  | {
      status: "resolved";
      source: "learned" | "openai";
      food: NutritionFoodRecord;
      parsedItem: ParsedFoodItemCandidate;
      matchedName: string;
    }
  | {
      status: "not_found";
    };

export type ParsedFoodItemResolution =
  | {
      status: "matched";
      source: "deterministic" | "learned" | "openai";
      food: NutritionFoodRecord;
      parsedItem: ParsedFoodItemCandidate;
      matchedName: string;
    }
  | Extract<FoodMatchResult, { status: "ambiguous" }>
  | {
      status: "not_found";
    };

const minimumConfidence = 0.65;

const structuredFallbackSchema = z.object({
  canonicalName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  aliases: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  category: z.string().trim().min(1).max(80).nullable().optional(),
  servingGrams: z.number().positive().max(2000).nullable().optional(),
  caloriesPer100g: z.number().min(0).max(1000),
  proteinPer100g: z.number().min(0).max(100),
  fatPer100g: z.number().min(0).max(100),
  carbsPer100g: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  isEstimate: z.boolean(),
  needsClarification: z.boolean(),
});

const defaultAdapter = createOpenAiFoodFallbackAdapter({
  apiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_FOOD_DRAFT_MODEL,
});

const defaultRepository: LearnedFoodRepository = {
  findMatch: findLearnedFoodCandidateMatch,
  incrementTimesSeen: incrementLearnedFoodTimesSeen,
  saveOpenAiResult: saveOpenAiLearnedFoodCandidate,
};

export async function resolveParsedFoodItemWithFallback(input: {
  item: ParsedFoodItemCandidate;
  foods: NutritionFoodRecord[];
  userId: string;
  language: SupportedLanguage;
  fallbackResolver?: (input: {
    userId: string;
    rawInput: string;
    language: SupportedLanguage;
    gramsHint?: number;
  }) => Promise<FoodFallbackResolution>;
}): Promise<ParsedFoodItemResolution> {
  const match = matchFoodCandidate(input.item, input.foods);

  if (match.status === "matched") {
    return {
      status: "matched",
      source: "deterministic",
      food: match.food,
      parsedItem: input.item,
      matchedName: match.matchedName,
    };
  }

  if (match.status === "ambiguous") {
    return match;
  }

  const fallbackResolver = input.fallbackResolver ?? resolveFoodFallback;
  const fallback = await fallbackResolver({
    userId: input.userId,
    rawInput: input.item.rawLabel,
    language: input.language,
    gramsHint: input.item.grams,
  });

  if (fallback.status !== "resolved") {
    return {
      status: "not_found",
    };
  }

  return {
    status: "matched",
    source: fallback.source,
    food: fallback.food,
    parsedItem: fallback.parsedItem,
    matchedName: fallback.matchedName,
  };
}

export async function resolveFoodFallback(input: {
  userId: string;
  rawInput: string;
  language: SupportedLanguage;
  gramsHint?: number;
  learnedRepository?: LearnedFoodRepository;
  adapter?: StructuredFoodFallbackAdapter;
}): Promise<FoodFallbackResolution> {
  const normalizedInput = normalizeFoodText(input.rawInput);

  if (!looksLikeFoodInput(normalizedInput)) {
    return {
      status: "not_found",
    };
  }

  const repository = input.learnedRepository ?? defaultRepository;
  const learned = await repository.findMatch(input.userId, normalizedInput);

  if (learned) {
    const updated = await repository.incrementTimesSeen(learned);
    return buildResolvedFallback(updated, "learned", input.gramsHint);
  }

  const adapter = input.adapter ?? defaultAdapter;
  const fallback = await adapter.resolveFood(input.rawInput, input.language);

  if (fallback.status !== "parsed") {
    return {
      status: "not_found",
    };
  }

  const validatedFallback = validateStructuredFallback(fallback.value);

  if (!validatedFallback) {
    return {
      status: "not_found",
    };
  }

  const saved = await repository.saveOpenAiResult({
    userId: input.userId,
    rawInput: input.rawInput,
    normalizedInput,
    fallback: validatedFallback,
  });

  return buildResolvedFallback(saved, "openai", input.gramsHint);
}

function validateStructuredFallback(
  value: unknown,
): StructuredLearnedFoodFallback | null {
  const result = structuredFallbackSchema.safeParse(value);

  if (!result.success) {
    return null;
  }

  if (
    result.data.needsClarification ||
    result.data.confidence < minimumConfidence
  ) {
    return null;
  }

  return {
    ...result.data,
    aliases: result.data.aliases,
    category: result.data.category ?? null,
    servingGrams: result.data.servingGrams ?? null,
  };
}

function buildResolvedFallback(
  record: LearnedFoodCandidateRecord,
  source: "learned" | "openai",
  gramsHint?: number,
): FoodFallbackResolution {
  const grams = gramsHint ?? Number(record.servingGrams ?? 0);

  if (!Number.isFinite(grams) || grams <= 0) {
    return {
      status: "not_found",
    };
  }

  const food = learnedFoodCandidateToNutritionFoodRecord(record);

  return {
    status: "resolved",
    source,
    food,
    matchedName: record.displayName,
    parsedItem: {
      rawLabel: record.rawInput,
      normalizedLabel: record.normalizedInput,
      quantity: gramsHint ?? 1,
      unit: gramsHint ? "g" : "serving",
      grams,
      ...(record.isEstimate ? { isEstimate: true } : {}),
    },
  };
}

function looksLikeFoodInput(normalizedInput: string): boolean {
  return (
    normalizedInput.length >= 2 &&
    normalizedInput.length <= 200 &&
    /\p{L}/u.test(normalizedInput)
  );
}
