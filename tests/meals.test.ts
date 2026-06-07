import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CalculatedMeal } from "../src/nutrition/food.types.js";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const { formatDailyTotals } = await import("../src/bot/food-logging.js");
const { buildMealEntryCreateData, sumDailyTotals } = await import(
  "../src/meals/meals.service.js"
);

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
});

describe("daily totals", () => {
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
