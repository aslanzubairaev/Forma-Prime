import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchFoodCandidate } from "../src/nutrition/food-matcher.js";
import { parseFoodLogMessage } from "../src/nutrition/food-parser.js";
import {
  calculateMeal,
  calculateMealItem,
} from "../src/nutrition/nutrition-calculator.js";
import type {
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "../src/nutrition/food.types.js";

const chickenBreast: NutritionFoodRecord = {
  id: "food_chicken_breast",
  slug: "chicken-breast-cooked-skinless",
  nameRu: "Куриная грудка, готовая, без кожи",
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
    {
      alias: "куриная грудка",
      languageCode: "ru",
      normalizedAlias: "куриная грудка",
    },
    {
      alias: "куриной грудки",
      languageCode: "ru",
      normalizedAlias: "куриной грудки",
    },
  ],
};

const chickenThigh: NutritionFoodRecord = {
  id: "food_chicken_thigh",
  slug: "chicken-thigh-cooked-skinless",
  nameRu: "Куриное бедро, готовое, без кожи",
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

const cookedRice: NutritionFoodRecord = {
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
      alias: "cooked rice",
      languageCode: "en",
      normalizedAlias: "cooked rice",
    },
    {
      alias: "риса",
      languageCode: "ru",
      normalizedAlias: "риса",
    },
  ],
};

describe("food parser", () => {
  it("parses 200 g chicken breast", () => {
    const result = parseFoodLogMessage("200 g chicken breast");

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.rawLabel, "chicken breast");
    assert.equal(result.items[0]?.grams, 200);
  });

  it("parses 200g chicken breast", () => {
    const result = parseFoodLogMessage("200g chicken breast");

    assert.equal(result.items[0]?.rawLabel, "chicken breast");
    assert.equal(result.items[0]?.grams, 200);
  });

  it("parses 200 г куриной грудки", () => {
    const result = parseFoodLogMessage("200 г куриной грудки");

    assert.equal(result.items[0]?.rawLabel, "куриной грудки");
    assert.equal(result.items[0]?.grams, 200);
  });

  it("parses 200,5 г риса", () => {
    const result = parseFoodLogMessage("200,5 г риса");

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.rawLabel, "риса");
    assert.equal(result.items[0]?.grams, 200.5);
  });

  it("parses 200.5 g rice", () => {
    const result = parseFoodLogMessage("200.5 g rice");

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.rawLabel, "rice");
    assert.equal(result.items[0]?.grams, 200.5);
  });

  it("parses 200 g chicken breast and 250 g cooked rice", () => {
    const result = parseFoodLogMessage(
      "200 g chicken breast and 250 g cooked rice",
    );

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.rawLabel, "chicken breast");
    assert.equal(result.items[1]?.rawLabel, "cooked rice");
    assert.equal(result.items[1]?.grams, 250);
  });

  it("parses multiple items separated by comma", () => {
    const result = parseFoodLogMessage(
      "200 g chicken breast, 250 g cooked rice",
    );

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.rawLabel, "chicken breast");
    assert.equal(result.items[1]?.rawLabel, "cooked rice");
  });

  it("parses 200 г куриной грудки и 250 г риса", () => {
    const result = parseFoodLogMessage("200 г куриной грудки и 250 г риса");

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0]?.rawLabel, "куриной грудки");
    assert.equal(result.items[0]?.grams, 200);
    assert.equal(result.items[1]?.rawLabel, "риса");
    assert.equal(result.items[1]?.grams, 250);
  });
});

describe("food matcher", () => {
  it("matches exact alias", () => {
    const candidate = candidateFor("chicken breast", 200);
    const result = matchFoodCandidate(candidate, [chickenBreast, cookedRice]);

    assert.equal(result.status, "matched");
    assert.equal(result.status === "matched" ? result.food.id : "", chickenBreast.id);
  });

  it("matches normalized food name", () => {
    const candidate = candidateFor("white rice cooked", 250);
    const result = matchFoodCandidate(candidate, [chickenBreast, cookedRice]);

    assert.equal(result.status, "matched");
    assert.equal(result.status === "matched" ? result.food.id : "", cookedRice.id);
  });

  it("handles ambiguous contains match safely", () => {
    const candidate = candidateFor("chicken", 200);
    const result = matchFoodCandidate(candidate, [chickenBreast, chickenThigh]);

    assert.equal(result.status, "ambiguous");
    assert.equal(result.status === "ambiguous" ? result.options.length : 0, 2);
  });
});

describe("nutrition calculator", () => {
  it("calculates per-item nutrition", () => {
    const item = calculateMealItem(
      chickenBreast,
      candidateFor("chicken breast", 200),
      "Chicken breast, cooked, skinless",
    );

    assert.equal(item.calories, 330);
    assert.equal(item.proteinG, 62);
    assert.equal(item.fatG, 7.2);
    assert.equal(item.carbsG, 0);
  });

  it("calculates multi-item totals", () => {
    const meal = calculateMeal([
      calculateMealItem(
        chickenBreast,
        candidateFor("chicken breast", 200),
        "Chicken breast, cooked, skinless",
      ),
      calculateMealItem(cookedRice, candidateFor("cooked rice", 250), "White rice"),
    ]);

    assert.equal(meal.totals.calories, 655);
    assert.equal(meal.totals.proteinG, 67.95);
    assertApproxEqual(meal.totals.fatG, 7.725);
    assert.equal(meal.totals.carbsG, 71.475);
  });
});

function candidateFor(label: string, grams: number): ParsedFoodItemCandidate {
  return {
    rawLabel: label,
    normalizedLabel: label.toLowerCase(),
    quantity: grams,
    unit: "g",
    grams,
  };
}

function assertApproxEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 0.000001);
}
