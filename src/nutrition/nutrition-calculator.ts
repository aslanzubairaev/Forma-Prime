import type {
  CalculatedMeal,
  CalculatedMealItem,
  CalculatedMealTotals,
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "./food.types.js";

export function calculateMealItem(
  food: NutritionFoodRecord,
  parsedItem: ParsedFoodItemCandidate,
  matchedName: string,
): CalculatedMealItem {
  const multiplier = parsedItem.grams / 100;

  return {
    food,
    matchedName,
    rawLabel: parsedItem.rawLabel,
    quantity: parsedItem.quantity,
    unit: parsedItem.unit,
    grams: parsedItem.grams,
    ...(parsedItem.isEstimate ? { isEstimate: true } : {}),
    calories: toNumber(food.caloriesPer100g) * multiplier,
    proteinG: toNumber(food.proteinPer100g) * multiplier,
    fatG: toNumber(food.fatPer100g) * multiplier,
    carbsG: toNumber(food.carbsPer100g) * multiplier,
  };
}

export function calculateMeal(items: CalculatedMealItem[]): CalculatedMeal {
  return {
    items,
    totals: calculateTotals(items),
  };
}

function calculateTotals(items: CalculatedMealItem[]): CalculatedMealTotals {
  return items.reduce<CalculatedMealTotals>(
    (totals, item) => ({
      calories: totals.calories + item.calories,
      proteinG: totals.proteinG + item.proteinG,
      fatG: totals.fatG + item.fatG,
      carbsG: totals.carbsG + item.carbsG,
    }),
    {
      calories: 0,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
    },
  );
}

function toNumber(value: unknown): number {
  return Number(value);
}
