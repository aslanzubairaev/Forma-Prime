import { parseFoodLogMessage } from "./food-parser.js";
import { getActiveNutritionFoods } from "./food.repository.js";
import { resolveParsedFoodItems } from "./food-resolution.js";
import type {
  CalculatedMeal,
  FoodMatchResult,
  ParsedFoodItemCandidate,
} from "./food.types.js";

export type FoodLogResolution =
  | {
      status: "matched";
      parsedItems: ParsedFoodItemCandidate[];
      meal: CalculatedMeal;
    }
  | {
      status: "parse_failed";
      rejectedParts: string[];
    }
  | {
      status: "not_found";
      unmatchedItems: ParsedFoodItemCandidate[];
    }
  | {
      status: "partial";
      parsedItems: ParsedFoodItemCandidate[];
      meal: CalculatedMeal;
      unmatchedItems: ParsedFoodItemCandidate[];
    }
  | {
      status: "ambiguous";
      item: ParsedFoodItemCandidate;
      options: FoodMatchResult & { status: "ambiguous" };
    };

export async function resolveFoodLogMessage(
  rawText: string,
): Promise<FoodLogResolution> {
  const parsed = parseFoodLogMessage(rawText);

  if (parsed.items.length === 0 || parsed.rejectedParts.length > 0) {
    return {
      status: "parse_failed",
      rejectedParts: parsed.rejectedParts.length > 0 ? parsed.rejectedParts : [rawText],
    };
  }

  const foods = await getActiveNutritionFoods();
  const resolved = resolveParsedFoodItems(parsed.items, foods);

  if (resolved.status === "not_found") {
    return {
      status: "not_found",
      unmatchedItems: resolved.unmatchedItems,
    };
  }

  if (resolved.status === "partial") {
    return {
      status: "partial",
      parsedItems: parsed.items,
      meal: resolved.meal,
      unmatchedItems: resolved.unmatchedItems,
    };
  }

  if (resolved.status === "ambiguous") {
    return resolved;
  }

  return {
    status: "matched",
    parsedItems: parsed.items,
    meal: resolved.meal,
  };
}
