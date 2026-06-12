export type ParsedFoodItemCandidate = {
  rawLabel: string;
  normalizedLabel: string;
  quantity: number;
  unit: "g" | "piece" | "serving";
  grams: number;
  isEstimate?: boolean;
};

export type FoodAliasRecord = {
  alias: string;
  languageCode: string;
  normalizedAlias: string;
};

export type NutritionFoodRecord = {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
  isCustom?: boolean;
  caloriesPer100g: unknown;
  proteinPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  aliases: FoodAliasRecord[];
};

export type CustomFoodInputParseResult =
  | {
      status: "valid";
      value: {
        name: string;
        caloriesPer100g: number;
        proteinPer100g: number;
        fatPer100g: number;
        carbsPer100g: number;
      };
    }
  | {
      status: "invalid";
    };

export type RecentFood = {
  id: string;
  name: string;
  grams: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  consumedAt: Date;
};

export type FoodMatchResult =
  | {
      status: "matched";
      food: NutritionFoodRecord;
      matchedName: string;
    }
  | {
      status: "ambiguous";
      options: NutritionFoodRecord[];
    }
  | {
      status: "not_found";
    };

export type CalculatedMealItem = {
  food: NutritionFoodRecord;
  matchedName: string;
  rawLabel: string;
  quantity: number;
  unit: "g" | "piece" | "serving";
  grams: number;
  isEstimate?: boolean;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export type CalculatedMealTotals = {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

export type CalculatedMeal = {
  items: CalculatedMealItem[];
  totals: CalculatedMealTotals;
};
