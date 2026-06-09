import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CalculatedMeal } from "../src/nutrition/food.types.js";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const { formatDailyTotals, formatRecentFoods } = await import(
  "../src/bot/food-logging.js"
);
const {
  buildMealEntryCreateData,
  buildMealEntryItemsDeleteWhere,
  buildMealEntryUpdateData,
  buildLatestMealDeleteWhere,
  buildQuickRelogMealEntryCreateData,
  selectLatestMealEntry,
  selectRecentFoodsFromItems,
  sumDailyTotals,
} = await import(
  "../src/meals/meals.service.js"
);
const {
  buildCustomFoodUpsertData,
  parseCustomFoodInput,
} = await import("../src/nutrition/custom-food.service.js");
const { matchFoodCandidate } = await import("../src/nutrition/food-matcher.js");
const { getZonedDayRange } = await import("../src/time/timezone.js");

const meal: CalculatedMeal = {
  items: [
    {
      food: {
        id: "food_chicken_breast",
        slug: "chicken-breast-cooked-skinless",
        nameRu: "Куриная грудка",
        nameEn: "Chicken breast",
        caloriesPer100g: 165,
        proteinPer100g: 31,
        fatPer100g: 3.6,
        carbsPer100g: 0,
        aliases: [],
      },
      matchedName: "Chicken breast",
      rawLabel: "chicken breast",
      quantity: 200,
      unit: "g",
      grams: 200,
      calories: 330,
      proteinG: 62,
      fatG: 7.2,
      carbsG: 0,
    },
  ],
  totals: {
    calories: 330,
    proteinG: 62,
    fatG: 7.2,
    carbsG: 0,
  },
};

describe("meal logging", () => {
  it("builds MealEntry create data with MealEntryItem rows", () => {
    const data = buildMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      rawText: "200 g chicken breast",
      meal,
      consumedAt: new Date("2026-06-06T10:00:00.000Z"),
    }) as any;

    assert.equal(data.rawText, "200 g chicken breast");
    assert.equal(data.totalCalories, 330);
    assert.equal(data.totalProteinG, 62);
    assert.equal(data.items.create.length, 1);
    assert.equal(data.items.create[0].matchedName, "Chicken breast");
    assert.equal(data.items.create[0].grams, 200);
  });

  it("builds MealEntry create data for custom foods", () => {
    const data = buildMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      rawText: "150 g house yogurt",
      meal: {
        items: [
          {
            ...meal.items[0]!,
            food: {
              ...meal.items[0]!.food,
              id: "custom_food_1",
              isCustom: true,
            },
            matchedName: "House yogurt",
          },
        ],
        totals: meal.totals,
      },
      consumedAt: new Date("2026-06-06T10:00:00.000Z"),
    }) as any;

    assert.equal(data.items.create[0].customFood.connect.id, "custom_food_1");
    assert.equal(data.items.create[0].food, undefined);
  });
});

describe("latest meal edit/delete", () => {
  it("selects the latest meal by consumedAt and createdAt", () => {
    const latest = selectLatestMealEntry([
      mealEntrySummary("older", "2026-06-08T10:00:00.000Z", "2026-06-08T10:00:01.000Z"),
      mealEntrySummary("tie-older-created", "2026-06-09T10:00:00.000Z", "2026-06-09T10:00:01.000Z"),
      mealEntrySummary("latest", "2026-06-09T10:00:00.000Z", "2026-06-09T10:00:02.000Z"),
    ]);

    assert.equal(latest?.id, "latest");
  });

  it("builds latest meal update data without mutating original identity", () => {
    const data = buildMealEntryUpdateData({
      rawText: "200 g chicken breast",
      meal,
    }) as any;

    assert.equal(data.rawText, "200 g chicken breast");
    assert.equal(data.totalCalories, 330);
    assert.equal(data.items.create.length, 1);
    assert.equal(data.items.create[0].food.connect.id, "food_chicken_breast");
  });

  it("builds user-scoped latest meal delete filters", () => {
    assert.deepEqual(buildLatestMealDeleteWhere({
      userId: "user_1",
      mealEntryId: "meal_1",
    }), {
      id: "meal_1",
      userId: "user_1",
    });
    assert.deepEqual(buildMealEntryItemsDeleteWhere({
      userId: "user_1",
      mealEntryId: "meal_1",
    }), {
      mealEntryId: "meal_1",
      mealEntry: {
        userId: "user_1",
      },
    });
  });
});

describe("custom foods", () => {
  it("parses custom food command input", () => {
    assert.deepEqual(parseCustomFoodInput("House yogurt | 90 | 10,5 | 2 | 4"), {
      status: "valid",
      value: {
        name: "House yogurt",
        caloriesPer100g: 90,
        proteinPer100g: 10.5,
        fatPer100g: 2,
        carbsPer100g: 4,
      },
    });
  });

  it("rejects invalid custom food command input", () => {
    assert.deepEqual(parseCustomFoodInput("House yogurt 90 10 2 4"), {
      status: "invalid",
    });
  });

  it("builds deterministic custom food upsert data", () => {
    const data = buildCustomFoodUpsertData({
      userId: "user_1",
      name: "House Yogurt",
      caloriesPer100g: 90,
      proteinPer100g: 10,
      fatPer100g: 2,
      carbsPer100g: 4,
    });

    assert.deepEqual(data.where, {
      userId_normalizedName: {
        userId: "user_1",
        normalizedName: "house yogurt",
      },
    });
    assert.equal((data.create as any).normalizedName, "house yogurt");
    assert.equal((data.update as any).isActive, true);
  });

  it("matches a custom food through the existing matcher", () => {
    const match = matchFoodCandidate(
      {
        rawLabel: "house yogurt",
        normalizedLabel: "house yogurt",
        quantity: 150,
        unit: "g",
        grams: 150,
      },
      [
        {
          id: "custom_food_1",
          slug: "custom-custom_food_1",
          nameRu: "House yogurt",
          nameEn: "House yogurt",
          isCustom: true,
          caloriesPer100g: 90,
          proteinPer100g: 10,
          fatPer100g: 2,
          carbsPer100g: 4,
          aliases: [
            {
              alias: "House yogurt",
              languageCode: "custom",
              normalizedAlias: "house yogurt",
            },
          ],
        },
      ],
    );

    assert.equal(match.status, "matched");
    assert.equal(match.status === "matched" ? match.food.isCustom : false, true);
  });
});

describe("recent foods", () => {
  it("deduplicates recent foods by source while keeping latest amounts", () => {
    const recentFoods = selectRecentFoodsFromItems([
      recentItem("item_latest", "food_rice", null, "Rice", 250, "2026-06-08T10:00:00.000Z"),
      recentItem("item_old", "food_rice", null, "Rice", 100, "2026-06-07T10:00:00.000Z"),
      recentItem("item_custom", null, "custom_yogurt", "House yogurt", 150, "2026-06-06T10:00:00.000Z"),
    ]);

    assert.deepEqual(
      recentFoods.map((food) => ({
        id: food.id,
        grams: food.grams,
      })),
      [
        { id: "item_latest", grams: 250 },
        { id: "item_custom", grams: 150 },
      ],
    );
  });

  it("builds quick re-log create data from a global food item", () => {
    const data = buildQuickRelogMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      sourceItem: {
        foodId: "food_rice",
        customFoodId: null,
        matchedName: "Rice",
        quantity: 250,
        unit: "g",
        grams: 250,
        calories: 325,
        proteinG: 5.95,
        fatG: 0.525,
        carbsG: 71.475,
      },
      consumedAt: new Date("2026-06-08T10:00:00.000Z"),
    }) as any;

    assert.equal(data.rawText, "relog:Rice");
    assert.equal(data.totalCalories, 325);
    assert.equal(data.items.create[0].food.connect.id, "food_rice");
  });

  it("builds quick re-log create data from a custom food item", () => {
    const data = buildQuickRelogMealEntryCreateData({
      userId: "user_1",
      telegramUserId: 123n,
      sourceItem: {
        foodId: null,
        customFoodId: "custom_yogurt",
        matchedName: "House yogurt",
        quantity: 150,
        unit: "g",
        grams: 150,
        calories: 135,
        proteinG: 15,
        fatG: 3,
        carbsG: 6,
      },
    }) as any;

    assert.equal(data.items.create[0].customFood.connect.id, "custom_yogurt");
    assert.equal(data.items.create[0].food, undefined);
  });

  it("formats recent foods for quick re-log", () => {
    const text = formatRecentFoods("en", [
      {
        id: "item_1",
        name: "Rice",
        grams: 250,
        calories: 325,
        proteinG: 5.95,
        fatG: 0.525,
        carbsG: 71.475,
        consumedAt: new Date("2026-06-08T10:00:00.000Z"),
      },
    ]);

    assert.match(text, /Recent foods:/);
    assert.match(text, /1\. Rice  250 g, 325 kcal/);
  });
});

describe("daily totals", () => {
  it("computes day boundaries in the user's timezone", () => {
    const referenceDate = new Date("2026-06-07T22:30:00.000Z");
    const parisRange = getZonedDayRange(referenceDate, "Europe/Paris");
    const newYorkRange = getZonedDayRange(referenceDate, "America/New_York");

    assert.equal(parisRange.start.toISOString(), "2026-06-07T22:00:00.000Z");
    assert.equal(parisRange.end.toISOString(), "2026-06-08T22:00:00.000Z");
    assert.equal(newYorkRange.start.toISOString(), "2026-06-07T04:00:00.000Z");
    assert.equal(newYorkRange.end.toISOString(), "2026-06-08T04:00:00.000Z");
  });

  it("sums todays meals", () => {
    const totals = sumDailyTotals([
      {
        totalCalories: 330,
        totalProteinG: 62,
        totalFatG: 7.2,
        totalCarbsG: 0,
      },
      {
        totalCalories: 325,
        totalProteinG: 5.95,
        totalFatG: 0.525,
        totalCarbsG: 71.475,
      },
    ]);

    assert.equal(totals.calories, 655);
    assert.equal(totals.proteinG, 67.95);
    assertApproxEqual(totals.fatG, 7.725);
    assert.equal(totals.carbsG, 71.475);
  });

  it("formats totals against targets", () => {
    const text = formatDailyTotals("en", {
      totals: {
        calories: 655,
        proteinG: 67.95,
        fatG: 7.725,
        carbsG: 71.475,
      },
      targets: {
        caloriesTarget: 2300,
        proteinTargetG: 160,
        fatTargetG: 70,
        carbsTargetG: 250,
      },
    });

    assert.match(text, /Calories 655 \/ 2300/);
    assert.match(text, /Protein 68 \/ 160/);
    assert.match(text, /Fat 8 \/ 70/);
    assert.match(text, /Carbs 71 \/ 250/);
  });
});

function assertApproxEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 0.000001);
}

function recentItem(
  id: string,
  foodId: string | null,
  customFoodId: string | null,
  matchedName: string,
  grams: number,
  consumedAt: string,
) {
  return {
    id,
    foodId,
    customFoodId,
    matchedName,
    grams,
    calories: grams,
    proteinG: 1,
    fatG: 2,
    carbsG: 3,
    mealEntry: {
      consumedAt: new Date(consumedAt),
    },
  };
}

function mealEntrySummary(id: string, consumedAt: string, createdAt: string) {
  return {
    id,
    consumedAt: new Date(consumedAt),
    createdAt: new Date(createdAt),
  };
}
