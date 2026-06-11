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
