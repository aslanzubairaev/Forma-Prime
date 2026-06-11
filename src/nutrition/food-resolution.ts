import { matchFoodCandidate } from "./food-matcher.js";
import { calculateMeal, calculateMealItem } from "./nutrition-calculator.js";
import type {
  CalculatedMeal,
  FoodMatchResult,
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "./food.types.js";

export type FoodItemResolutionResult =
  | {
      status: "matched";
      meal: CalculatedMeal;
    }
  | {
      status: "partial";
      meal: CalculatedMeal;
      unmatchedItems: ParsedFoodItemCandidate[];
    }
  | {
      status: "not_found";
      unmatchedItems: ParsedFoodItemCandidate[];
    }
  | {
      status: "ambiguous";
      item: ParsedFoodItemCandidate;
      options: FoodMatchResult & { status: "ambiguous" };
    };

export function resolveParsedFoodItems(
  parsedItems: ParsedFoodItemCandidate[],
  foods: NutritionFoodRecord[],
  getMatchedName: (food: NutritionFoodRecord) => string = (food) => food.nameEn,
): FoodItemResolutionResult {
  const calculatedItems = [];
  const unmatchedItems: ParsedFoodItemCandidate[] = [];

  for (const item of parsedItems) {
    const match = matchFoodCandidate(item, foods);

    if (match.status === "not_found") {
      unmatchedItems.push(item);
      continue;
    }

    if (match.status === "ambiguous") {
      return {
        status: "ambiguous",
        item,
        options: match,
      };
    }

    calculatedItems.push(
      calculateMealItem(match.food, item, getMatchedName(match.food)),
    );
  }

  if (calculatedItems.length === 0) {
    return {
      status: "not_found",
      unmatchedItems,
    };
  }

  const meal = calculateMeal(calculatedItems);

  if (unmatchedItems.length > 0) {
    return {
      status: "partial",
      meal,
      unmatchedItems,
    };
  }

  return {
    status: "matched",
    meal,
  };
}
