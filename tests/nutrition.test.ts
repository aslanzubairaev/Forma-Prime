import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchFoodCandidate } from "../src/nutrition/food-matcher.js";
import { resolveParsedFoodItems } from "../src/nutrition/food-resolution.js";
import {
  buildNutritionFoodAliasCreateData,
  buildNutritionFoodUpsertArgs,
  ensureEssentialNutritionFoodsSeeded,
  essentialSeedFoods,
} from "../src/nutrition/food-catalog.seed.js";
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

const egg: NutritionFoodRecord = seedToNutritionFoodRecord(
  "food_egg",
  essentialSeedFoods.find((food) => food.slug === "egg-whole")!,
);

const wheyProtein: NutritionFoodRecord = seedToNutritionFoodRecord(
  "food_whey",
  essentialSeedFoods.find((food) => food.slug === "whey-protein-powder")!,
);

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

  it("parses compact gram unit without a space", () => {
    const result = parseFoodLogMessage("260гр жареной грудки");

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.rawLabel, "жареной грудки");
    assert.equal(result.items[0]?.grams, 260);
  });

  it("parses common count-based egg input as grams", () => {
    const result = parseFoodLogMessage("4 варенных яйца");

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.rawLabel, "варенных яйца");
    assert.equal(result.items[0]?.normalizedLabel, "вареные яйца");
    assert.equal(result.items[0]?.unit, "piece");
    assert.equal(result.items[0]?.quantity, 4);
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

  it("parses mixed live free text when every part has a supported quantity form", () => {
    const result = parseFoodLogMessage(
      "260гр жареной грудки и 4 варенных яиц и 3 порции протеина",
    );

    assert.equal(result.rejectedParts.length, 0);
    assert.equal(result.items.length, 3);
    assert.equal(result.items[0]?.rawLabel, "жареной грудки");
    assert.equal(result.items[0]?.grams, 260);
    assert.equal(result.items[1]?.normalizedLabel, "вареные яйца");
    assert.equal(result.items[1]?.grams, 200);
    assert.equal(result.items[2]?.normalizedLabel, "протеин");
    assert.equal(result.items[2]?.unit, "serving");
    assert.equal(result.items[2]?.grams, 90);
  });

  it("parses core Russian live food logging inputs", () => {
    const cases = [
      {
        input: "250 г куриной грудки",
        label: "куриной грудки",
        grams: 250,
        unit: "g",
      },
      {
        input: "250гр куриной грудки",
        label: "куриной грудки",
        grams: 250,
        unit: "g",
      },
      {
        input: "200 г варёного риса",
        label: "варёного риса",
        grams: 200,
        unit: "g",
      },
      {
        input: "150 г гречки",
        label: "гречки",
        grams: 150,
        unit: "g",
      },
      {
        input: "180 г макарон",
        label: "макарон",
        grams: 180,
        unit: "g",
      },
      {
        input: "4 варёных яйца",
        label: "варёных яйца",
        grams: 200,
        unit: "piece",
      },
      {
        input: "3 жареных яйца",
        label: "жареных яйца",
        grams: 150,
        unit: "piece",
      },
      {
        input: "2 порции протеина",
        label: "порции протеина",
        grams: 60,
        unit: "serving",
      },
    ] as const;

    for (const testCase of cases) {
      const result = parseFoodLogMessage(testCase.input);

      assert.equal(result.rejectedParts.length, 0, testCase.input);
      assert.equal(result.items.length, 1, testCase.input);
      assert.equal(result.items[0]?.rawLabel, testCase.label, testCase.input);
      assert.equal(result.items[0]?.grams, testCase.grams, testCase.input);
      assert.equal(result.items[0]?.unit, testCase.unit, testCase.input);
    }
  });

  it("parses high-value quick meal phrases without explicit grams", () => {
    const cases = [
      {
        input: "протеиновый кофе",
        label: "протеиновый кофе",
        grams: 330,
      },
      {
        input: "лаваш с курицей",
        label: "лаваш с курицей",
        grams: 250,
      },
    ] as const;

    for (const testCase of cases) {
      const result = parseFoodLogMessage(testCase.input);

      assert.equal(result.rejectedParts.length, 0, testCase.input);
      assert.equal(result.items.length, 1, testCase.input);
      assert.equal(result.items[0]?.rawLabel, testCase.label, testCase.input);
      assert.equal(result.items[0]?.unit, "serving", testCase.input);
      assert.equal(result.items[0]?.quantity, 1, testCase.input);
      assert.equal(result.items[0]?.grams, testCase.grams, testCase.input);
    }
  });

  it("parses live smoke punctuation, separator, and count variants", () => {
    const separated = parseFoodLogMessage(
      "250 гр. куриной грудки; 200 г риса\n1 банан + 2 кусочка хлеба",
    );

    assert.equal(separated.rejectedParts.length, 0);
    assert.equal(separated.items.length, 4);
    assert.equal(separated.items[0]?.rawLabel, "куриной грудки");
    assert.equal(separated.items[0]?.grams, 250);
    assert.equal(separated.items[1]?.rawLabel, "риса");
    assert.equal(separated.items[1]?.grams, 200);
    assert.equal(separated.items[2]?.normalizedLabel, "банан");
    assert.equal(separated.items[2]?.unit, "piece");
    assert.equal(separated.items[2]?.grams, 120);
    assert.equal(separated.items[3]?.normalizedLabel, "хлеб");
    assert.equal(separated.items[3]?.unit, "piece");
    assert.equal(separated.items[3]?.grams, 70);
  });

  it("parses additional common live quick and count inputs", () => {
    const cases = [
      {
        input: "2 яблока",
        label: "яблоко",
        grams: 300,
        unit: "piece",
      },
      {
        input: "кофе с молоком",
        label: "кофе с молоком",
        grams: 250,
        unit: "serving",
      },
      {
        input: "1 кусок хлеба",
        label: "хлеб",
        grams: 35,
        unit: "piece",
      },
    ] as const;

    for (const testCase of cases) {
      const result = parseFoodLogMessage(testCase.input);

      assert.equal(result.rejectedParts.length, 0, testCase.input);
      assert.equal(result.items.length, 1, testCase.input);
      assert.equal(result.items[0]?.normalizedLabel, testCase.label, testCase.input);
      assert.equal(result.items[0]?.grams, testCase.grams, testCase.input);
      assert.equal(result.items[0]?.unit, testCase.unit, testCase.input);
    }
  });

  it("parses conversational protein serving word-order variants", () => {
    const cases = [
      ["2 порции протеина", 60],
      ["протеин 2 порции", 60],
      ["протеина 2 порции", 60],
      ["протеина две порции", 60],
      ["протеин две ложки", 60],
      ["протеина две ложки", 60],
      ["сегодня пил протеина три большие ложки", 90],
    ] as const;

    for (const [input, grams] of cases) {
      const result = parseFoodLogMessage(input);

      assert.equal(result.rejectedParts.length, 0, input);
      assert.equal(result.items.length, 1, input);
      assert.equal(result.items[0]?.normalizedLabel, "протеин", input);
      assert.equal(result.items[0]?.unit, "serving", input);
      assert.equal(result.items[0]?.grams, grams, input);
    }
  });

  it("parses conversational protein coffee and coffee variants", () => {
    const cases = [
      ["протеиновый кофе", "протеиновый кофе", 330],
      ["кофе протеиновый", "протеиновый кофе", 330],
      ["кофе протеиновое", "протеиновый кофе", 330],
      ["кофе с протеином", "протеиновый кофе", 330],
      ["сегодня пил протеиновый кофе", "протеиновый кофе", 330],
      ["кофе протеиновый 19 гр белка", "протеиновый кофе", 330],
      ["сегодня пил протеиновый кофе, 19 грамм белка", "протеиновый кофе", 330],
      ["кофе", "кофе", 200],
      ["кофе с молоком", "кофе с молоком", 250],
    ] as const;

    for (const [input, normalizedLabel, grams] of cases) {
      const result = parseFoodLogMessage(input);

      assert.equal(result.rejectedParts.length, 0, input);
      assert.equal(result.items.length, 1, input);
      assert.equal(result.items[0]?.normalizedLabel, normalizedLabel, input);
      assert.equal(result.items[0]?.unit, "serving", input);
      assert.equal(result.items[0]?.grams, grams, input);
    }
  });

  it("parses conversational fried egg count variants", () => {
    const cases = [
      "5 жареных яиц",
      "покушал 5 жареных яиц",
      "жареных 5 яиц",
      "жареные яйца 5 штук",
      "сегодня ел 5 жареных яиц",
    ] as const;

    for (const input of cases) {
      const result = parseFoodLogMessage(input);

      assert.equal(result.rejectedParts.length, 0, input);
      assert.equal(result.items.length, 1, input);
      assert.equal(result.items[0]?.normalizedLabel, "жареные яйца", input);
      assert.equal(result.items[0]?.unit, "piece", input);
      assert.equal(result.items[0]?.quantity, 5, input);
      assert.equal(result.items[0]?.grams, 250, input);
    }
  });

  it("parses expanded deterministic vocabulary and serving aliases", () => {
    const cases = [
      ["изолят две порции", "протеин", 60, "serving"],
      ["выпил протеин", "протеин", 30, "serving"],
      ["1 тортилья", "тортилья", 60, "piece"],
      ["кола зеро", "кола зеро", 330, "serving"],
      ["cola zero", "кола зеро", 330, "serving"],
    ] as const;

    for (const [input, normalizedLabel, grams, unit] of cases) {
      const result = parseFoodLogMessage(input);

      assert.equal(result.rejectedParts.length, 0, input);
      assert.equal(result.items.length, 1, input);
      assert.equal(result.items[0]?.normalizedLabel, normalizedLabel, input);
      assert.equal(result.items[0]?.grams, grams, input);
      assert.equal(result.items[0]?.unit, unit, input);
    }
  });

  it("parses common composed dish estimates without explicit grams", () => {
    const cases = [
      ["шаурма", "шаурма", 350],
      ["2 шаурмы", "шаурма", 700],
      ["две домашние шаурмы", "лаваш с курицей", 500],
      ["такос", "такос", 180],
      ["буррито", "буррито", 350],
      ["бутерброд", "бутерброд", 180],
      ["сэндвич", "бутерброд", 180],
      ["рис с курицей", "рис с курицей", 350],
      ["паста с курицей", "паста с курицей", 350],
      ["салат с курицей", "салат с курицей", 300],
    ] as const;

    for (const [input, normalizedLabel, grams] of cases) {
      const result = parseFoodLogMessage(input);

      assert.equal(result.rejectedParts.length, 0, input);
      assert.equal(result.items.length, 1, input);
      assert.equal(result.items[0]?.normalizedLabel, normalizedLabel, input);
      assert.equal(result.items[0]?.grams, grams, input);
      assert.equal(result.items[0]?.isEstimate, true, input);
    }
  });

  it("prefers deterministic ingredient parsing for homemade dish details", () => {
    const cases = [
      {
        input: "домашняя шаурма: лаваш 60 г, курица 150 г, йогурт 50 г",
        labels: ["лаваш", "курица", "йогурт"],
        grams: [60, 150, 50],
      },
      {
        input: "рис с курицей: 200 г риса, 150 г курицы",
        labels: ["риса", "курицы"],
        grams: [200, 150],
      },
    ] as const;

    for (const testCase of cases) {
      const result = parseFoodLogMessage(testCase.input);

      assert.equal(result.rejectedParts.length, 0, testCase.input);
      assert.deepEqual(
        result.items.map((item) => item.rawLabel),
        testCase.labels,
        testCase.input,
      );
      assert.deepEqual(
        result.items.map((item) => item.grams),
        testCase.grams,
        testCase.input,
      );
    }
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

  it("matches live chicken, egg, and protein aliases", () => {
    const foods = [
      seedToNutritionFoodRecord("food_chicken", essentialSeedFoods[0]!),
      cookedRice,
      egg,
      wheyProtein,
    ];
    const chickenMatch = matchFoodCandidate(candidateFor("жареной грудки", 260), foods);
    const eggMatch = matchFoodCandidate(candidateFor("яйца", 200), foods);
    const proteinMatch = matchFoodCandidate(candidateFor("протеин", 90), foods);

    assert.equal(
      chickenMatch.status === "matched" ? chickenMatch.food.slug : "",
      "chicken-breast-cooked-skinless",
    );
    assert.equal(
      eggMatch.status === "matched" ? eggMatch.food.slug : "",
      "egg-whole",
    );
    assert.equal(
      proteinMatch.status === "matched" ? proteinMatch.food.slug : "",
      "whey-protein-powder",
    );
  });

  it("matches core starter catalog Russian aliases", () => {
    const seededFoods = starterCatalogRecords();
    const cases = [
      ["куриной грудки", "chicken-breast-cooked-skinless"],
      ["варёного риса", "white-rice-cooked"],
      ["гречки", "buckwheat-cooked"],
      ["макарон", "pasta-cooked"],
      ["варёных яйца", "egg-boiled"],
      ["жареных яйца", "egg-fried"],
      ["порции протеина", "whey-protein-powder"],
      ["протеиновый кофе", "protein-coffee"],
      ["лаваш с курицей", "chicken-lavash-wrap"],
    ] as const;

    for (const [label, slug] of cases) {
      const result = matchFoodCandidate(candidateFor(label, 100), seededFoods);

      assert.equal(result.status, "matched", label);
      assert.equal(result.status === "matched" ? result.food.slug : "", slug);
    }
  });

  it("matches parsed core Russian live inputs without ambiguity", () => {
    const seededFoods = starterCatalogRecords();
    const cases = [
      ["250 г куриной грудки", "chicken-breast-cooked-skinless"],
      ["250гр куриной грудки", "chicken-breast-cooked-skinless"],
      ["200 г варёного риса", "white-rice-cooked"],
      ["150 г гречки", "buckwheat-cooked"],
      ["180 г макарон", "pasta-cooked"],
      ["4 варёных яйца", "egg-boiled"],
      ["3 жареных яйца", "egg-fried"],
      ["2 порции протеина", "whey-protein-powder"],
      ["протеиновый кофе", "protein-coffee"],
      ["лаваш с курицей", "chicken-lavash-wrap"],
    ] as const;

    for (const [input, slug] of cases) {
      const parsed = parseFoodLogMessage(input);
      const item = parsed.items[0];

      assert.ok(item, input);
      const result = matchFoodCandidate(item, seededFoods);

      assert.equal(result.status, "matched", input);
      assert.equal(result.status === "matched" ? result.food.slug : "", slug);
    }
  });

  it("matches additional live smoke food aliases", () => {
    const seededFoods = starterCatalogRecords();
    const cases = [
      ["200 г овсяной каши", "oatmeal-cooked"],
      ["250 г йогурта", "plain-yogurt"],
      ["180 г сырников", "syrniki"],
      ["150 г омлета", "omelet"],
      ["30 г сметаны", "sour-cream"],
      ["кофе с молоком", "coffee-with-milk"],
      ["200 г курицы", "chicken-breast-cooked-skinless"],
    ] as const;

    for (const [input, slug] of cases) {
      const parsed = parseFoodLogMessage(input);
      const item = parsed.items[0];

      assert.ok(item, input);
      const result = matchFoodCandidate(item, seededFoods);

      assert.equal(result.status, "matched", input);
      assert.equal(result.status === "matched" ? result.food.slug : "", slug);
    }
  });

  it("matches conversational protein, coffee, and egg inputs deterministically", () => {
    const seededFoods = starterCatalogRecords();
    const cases = [
      ["протеина две порции", "whey-protein-powder"],
      ["сегодня пил протеина три большие ложки", "whey-protein-powder"],
      ["кофе протеиновый 19 гр белка", "protein-coffee"],
      ["сегодня пил протеиновый кофе, 19 грамм белка", "protein-coffee"],
      ["кофе", "coffee"],
      ["кофе с молоком", "coffee-with-milk"],
      ["покушал 5 жареных яиц", "egg-fried"],
      ["жареные яйца 5 штук", "egg-fried"],
      ["250 г грудка куриная вареная", "chicken-breast-cooked-skinless"],
    ] as const;

    for (const [input, slug] of cases) {
      const parsed = parseFoodLogMessage(input);
      const item = parsed.items[0];

      assert.ok(item, input);
      const result = matchFoodCandidate(item, seededFoods);

      assert.equal(result.status, "matched", input);
      assert.equal(result.status === "matched" ? result.food.slug : "", slug);
    }
  });

  it("matches expanded vocabulary and common dish estimates deterministically", () => {
    const seededFoods = starterCatalogRecords();
    const cases = [
      ["изолят две порции", "whey-protein-powder"],
      ["1 тортилья", "tortilla"],
      ["кола зеро", "cola-zero"],
      ["шаурма", "shawarma"],
      ["две домашние шаурмы", "chicken-lavash-wrap"],
      ["такос", "tacos"],
      ["буррито", "burrito"],
      ["бутерброд", "sandwich"],
      ["рис с курицей", "chicken-rice-bowl"],
      ["паста с курицей", "chicken-pasta"],
      ["салат с курицей", "chicken-salad"],
    ] as const;

    for (const [input, slug] of cases) {
      const parsed = parseFoodLogMessage(input);
      const item = parsed.items[0];

      assert.ok(item, input);
      const result = matchFoodCandidate(item, seededFoods);

      assert.equal(result.status, "matched", input);
      assert.equal(result.status === "matched" ? result.food.slug : "", slug);
    }
  });

  it("returns not_found without inventing nutrition for unknown foods", () => {
    const result = matchFoodCandidate(
      candidateFor("марсианская каша", 100),
      starterCatalogRecords(),
    );

    assert.equal(result.status, "not_found");
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

  it("preserves dish estimate metadata through calculation", () => {
    const shawarma = seedToNutritionFoodRecord(
      "food_shawarma",
      essentialSeedFoods.find((food) => food.slug === "shawarma")!,
    );
    const parsed = parseFoodLogMessage("шаурма").items[0]!;
    const item = calculateMealItem(shawarma, parsed, "Shawarma");

    assert.equal(item.isEstimate, true);
  });
});

describe("food item resolution", () => {
  it("keeps matched nutrition while reporting unmatched items", () => {
    const result = resolveParsedFoodItems(
      [candidateFor("куриной грудки", 250), candidateFor("марсианская каша", 100)],
      starterCatalogRecords(),
    );

    assert.equal(result.status, "partial");
    assert.equal(result.status === "partial" ? result.meal.items.length : 0, 1);
    assert.equal(result.status === "partial" ? result.unmatchedItems.length : 0, 1);
    assert.equal(
      result.status === "partial" ? result.unmatchedItems[0]?.rawLabel : "",
      "марсианская каша",
    );
    assert.equal(
      result.status === "partial" ? result.meal.items[0]?.food.slug : "",
      "chicken-breast-cooked-skinless",
    );
  });

  it("returns not_found with no meal when every item is unmatched", () => {
    const result = resolveParsedFoodItems(
      [candidateFor("марсианская каша", 100)],
      starterCatalogRecords(),
    );

    assert.equal(result.status, "not_found");
    assert.equal(
      result.status === "not_found" ? result.unmatchedItems[0]?.rawLabel : "",
      "марсианская каша",
    );
  });

  it("keeps partial success for mixed live smoke inputs", () => {
    const parsed = parseFoodLogMessage("200 г риса; 100 г марсианской смеси");
    const result = resolveParsedFoodItems(parsed.items, starterCatalogRecords());

    assert.equal(parsed.rejectedParts.length, 0);
    assert.equal(result.status, "partial");
    assert.equal(result.status === "partial" ? result.meal.items.length : 0, 1);
    assert.equal(
      result.status === "partial" ? result.meal.items[0]?.food.slug : "",
      "white-rice-cooked",
    );
    assert.equal(
      result.status === "partial" ? result.unmatchedItems[0]?.rawLabel : "",
      "марсианской смеси",
    );
  });
});

describe("essential food catalog seed", () => {
  it("includes live food logging examples as seeded aliases", () => {
    const chicken = essentialSeedFoods.find(
      (food) => food.slug === "chicken-breast-cooked-skinless",
    );
    const rice = essentialSeedFoods.find(
      (food) => food.slug === "white-rice-cooked",
    );

    assert.ok(chicken);
    assert.ok(rice);
    assert.ok(chicken.aliases.en.includes("chicken breast"));
    assert.ok(chicken.aliases.ru.includes("куриной грудки"));
    assert.ok(chicken.aliases.ru.includes("жареной грудки"));
    assert.ok(rice.aliases.en.includes("cooked rice"));
    assert.ok(rice.aliases.ru.includes("риса"));
    assert.ok(essentialSeedFoods.some((food) => food.slug === "egg-whole"));
    assert.ok(essentialSeedFoods.some((food) => food.slug === "whey-protein-powder"));
  });

  it("contains a practical starter catalog v1", () => {
    const requiredSlugs = [
      "chicken-breast-cooked-skinless",
      "chicken-breast-fried",
      "turkey-cooked",
      "beef-lean-cooked",
      "tuna-canned-in-water",
      "egg-boiled",
      "egg-fried",
      "cottage-cheese",
      "greek-yogurt",
      "whey-protein-powder",
      "white-rice-cooked",
      "buckwheat-cooked",
      "pasta-cooked",
      "oats-dry",
      "potato-boiled",
      "lavash",
      "bread",
      "banana",
      "apple",
      "cucumber",
      "tomato",
      "lettuce",
      "greens",
      "olive-oil",
      "peanut-butter",
      "ketchup-zero",
      "hot-sauce",
      "protein-coffee",
      "protein-bar",
      "chocolate",
      "cookie-sweet-snack",
      "chicken-lavash-wrap",
      "oatmeal-cooked",
      "plain-yogurt",
      "syrniki",
      "omelet",
      "sour-cream",
      "coffee-with-milk",
      "coffee",
      "tortilla",
      "cola-zero",
      "shawarma",
      "tacos",
      "burrito",
      "sandwich",
      "chicken-salad",
      "chicken-rice-bowl",
      "chicken-pasta",
    ];

    assert.ok(essentialSeedFoods.length >= 40);

    for (const slug of requiredSlugs) {
      assert.ok(
        essentialSeedFoods.some((food) => food.slug === slug),
        `missing ${slug}`,
      );
    }
  });

  it("deduplicates aliases within a single bootstrap run", async () => {
    const createdAliases: string[] = [];

    await ensureEssentialNutritionFoodsSeeded({
      nutritionFood: {
        upsert: async (args: any) => ({
          id: args.where.slug,
        }),
      } as any,
      nutritionFoodAlias: {
        findMany: async () => [],
        create: async (args: any) => {
          createdAliases.push(
            `${args.data.food.connect.id}:${args.data.languageCode}:${args.data.normalizedAlias}`,
          );
          return {};
        },
      } as any,
    });

    assert.equal(createdAliases.length, new Set(createdAliases).size);
  });

  it("builds idempotent upsert data for startup catalog repair", () => {
    const data = buildNutritionFoodUpsertArgs(essentialSeedFoods[0]!);

    assert.equal(data.where.slug, "chicken-breast-cooked-skinless");
    assert.equal((data.create as any).isActive, true);
    assert.equal((data.update as any).isActive, true);
  });

  it("normalizes seeded aliases for matcher lookup", () => {
    const aliases = buildNutritionFoodAliasCreateData(
      "food_chicken",
      essentialSeedFoods[0]!,
    );

    assert.ok(
      aliases.some(
        (alias) =>
          alias.alias === "куриной грудки" &&
          alias.normalizedAlias === "куриной грудки",
      ),
    );
  });

  it("matches basic examples when startup seed records are loaded", () => {
    const seededFoods = [
      seedToNutritionFoodRecord("food_chicken", essentialSeedFoods[0]!),
      seedToNutritionFoodRecord(
        "food_rice",
        essentialSeedFoods.find((food) => food.slug === "white-rice-cooked")!,
      ),
    ];
    const chickenMatch = matchFoodCandidate(
      candidateFor("куриной грудки", 200),
      seededFoods,
    );
    const riceMatch = matchFoodCandidate(
      candidateFor("cooked rice", 250),
      seededFoods,
    );

    assert.equal(
      chickenMatch.status === "matched" ? chickenMatch.food.slug : "",
      "chicken-breast-cooked-skinless",
    );
    assert.equal(
      riceMatch.status === "matched" ? riceMatch.food.slug : "",
      "white-rice-cooked",
    );
  });

  it("does not recreate aliases that already exist during startup repair", async () => {
    const createdAliases: unknown[] = [];

    await ensureEssentialNutritionFoodsSeeded({
      nutritionFood: {
        upsert: async (args: any) => ({
          id: args.where.slug,
        }),
      } as any,
      nutritionFoodAlias: {
        findMany: async ({ where }: any) =>
          where.foodId === "chicken-breast-cooked-skinless"
            ? [
                {
                  languageCode: "en",
                  normalizedAlias: "chicken breast",
                },
              ]
            : [],
        create: async (args: any) => {
          createdAliases.push(args.data);
          return {};
        },
      } as any,
    });

    assert.equal(
      createdAliases.some(
        (alias: any) =>
          alias.languageCode === "en" &&
          alias.normalizedAlias === "chicken breast",
      ),
      false,
    );
    assert.ok(createdAliases.length > 0);
  });

  it("removes stale aliases during startup repair when supported", async () => {
    const deletedIds: string[] = [];

    await ensureEssentialNutritionFoodsSeeded({
      nutritionFood: {
        upsert: async (args: any) => ({
          id: args.where.slug,
        }),
      } as any,
      nutritionFoodAlias: {
        findMany: async ({ where }: any) =>
          where.foodId === "egg-whole"
            ? [
                {
                  id: "stale_boiled_alias",
                  languageCode: "ru",
                  normalizedAlias: "вареные яйца",
                },
              ]
            : [],
        create: async () => ({}),
        deleteMany: async (args: any) => {
          deletedIds.push(...args.where.id.in);
          return { count: args.where.id.in.length };
        },
      } as any,
    });

    assert.deepEqual(deletedIds, ["stale_boiled_alias"]);
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

function seedToNutritionFoodRecord(
  id: string,
  seed: (typeof essentialSeedFoods)[number],
): NutritionFoodRecord {
  return {
    id,
    slug: seed.slug,
    nameRu: seed.nameRu,
    nameEn: seed.nameEn,
    caloriesPer100g: seed.caloriesPer100g,
    proteinPer100g: seed.proteinPer100g,
    fatPer100g: seed.fatPer100g,
    carbsPer100g: seed.carbsPer100g,
    aliases: Object.entries(seed.aliases).flatMap(([languageCode, aliases]) =>
      aliases.map((alias) => ({
        alias,
        languageCode,
        normalizedAlias: alias.toLowerCase(),
      })),
    ),
  };
}

function starterCatalogRecords(): NutritionFoodRecord[] {
  return essentialSeedFoods.map((seed) =>
    seedToNutritionFoodRecord(`food_${seed.slug}`, seed),
  );
}
