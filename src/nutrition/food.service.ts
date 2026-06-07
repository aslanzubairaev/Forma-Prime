import { matchFoodCandidate } from "./food-matcher.js";
import { parseFoodLogMessage } from "./food-parser.js";
import { getActiveNutritionFoods } from "./food.repository.js";
import {
  calculateMeal,
  calculateMealItem,
} from "./nutrition-calculator.js";
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
      item: ParsedFoodItemCandidate;
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
  const calculatedItems = [];

  for (const item of parsed.items) {
    const match = matchFoodCandidate(item, foods);

    if (match.status === "not_found") {
      return {
        status: "not_found",
        item,
      };
    }

    if (match.status === "ambiguous") {
      return {
        status: "ambiguous",
        item,
        options: match,
      };
    }

    calculatedItems.push(calculateMealItem(match.food, item, match.matchedName));
  }

  return {
    status: "matched",
    parsedItems: parsed.items,
    meal: calculateMeal(calculatedItems),
  };
}
