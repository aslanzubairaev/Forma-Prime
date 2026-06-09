import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { normalizeFoodText } from "./food-normalization.js";

type SeedFood = {
  slug: string;
  nameRu: string;
  nameEn: string;
  category: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  aliases: {
    en: string[];
    ru: string[];
  };
};

const foodCatalogSource = {
  sourceType: "CURATED_GENERIC",
  sourceName: "Forma Prime essential catalog",
  sourceUrl: "https://fdc.nal.usda.gov/",
  sourceUpdatedAt: new Date("2026-06-06T00:00:00.000Z"),
  isVerified: true,
  isActive: true,
};

export const essentialSeedFoods: SeedFood[] = [
  {
    slug: "chicken-breast-cooked-skinless",
    nameRu: "Куриная грудка, готовая, без кожи",
    nameEn: "Chicken breast, cooked, skinless",
    category: "protein",
    caloriesPer100g: 165,
    proteinPer100g: 31,
    fatPer100g: 3.6,
    carbsPer100g: 0,
    aliases: {
      en: ["chicken breast", "cooked chicken breast", "chicken fillet"],
      ru: [
        "куриная грудка",
        "куриной грудки",
        "жареная грудка",
        "жареной грудки",
        "вареная грудка",
        "вареной грудки",
        "куриное филе",
        "куриного филе",
      ],
    },
  },
  {
    slug: "egg-whole",
    nameRu: "Яйцо куриное",
    nameEn: "Egg, whole",
    category: "protein",
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    fatPer100g: 9.5,
    carbsPer100g: 0.7,
    aliases: {
      en: ["egg", "eggs", "whole egg", "boiled egg", "boiled eggs"],
      ru: [
        "яйцо",
        "яйца",
        "яиц",
        "куриное яйцо",
        "куриные яйца",
        "вареное яйцо",
        "вареные яйца",
        "варенных яйца",
        "варенных яиц",
        "варёное яйцо",
        "варёные яйца",
      ],
    },
  },
  {
    slug: "white-rice-cooked",
    nameRu: "Рис белый, вареный",
    nameEn: "White rice, cooked",
    category: "carb",
    caloriesPer100g: 130,
    proteinPer100g: 2.38,
    fatPer100g: 0.21,
    carbsPer100g: 28.59,
    aliases: {
      en: ["cooked rice", "white rice", "rice"],
      ru: ["рис", "риса", "вареный рис", "белый рис"],
    },
  },
  {
    slug: "whey-protein-powder",
    nameRu: "Протеин сывороточный",
    nameEn: "Whey protein powder",
    category: "protein",
    caloriesPer100g: 400,
    proteinPer100g: 80,
    fatPer100g: 6,
    carbsPer100g: 8,
    aliases: {
      en: ["protein", "protein powder", "whey protein"],
      ru: ["протеин", "протеина", "сывороточный протеин"],
    },
  },
];

type NutritionFoodDelegate = PrismaClient["nutritionFood"];
type NutritionFoodAliasDelegate = PrismaClient["nutritionFoodAlias"];

export async function ensureEssentialNutritionFoodsSeeded(input: {
  nutritionFood?: Pick<NutritionFoodDelegate, "upsert">;
  nutritionFoodAlias?: Pick<NutritionFoodAliasDelegate, "findMany" | "create">;
} = {}): Promise<void> {
  const nutritionFood = input.nutritionFood ?? prisma.nutritionFood;
  const nutritionFoodAlias = input.nutritionFoodAlias ?? prisma.nutritionFoodAlias;

  for (const food of essentialSeedFoods) {
    const savedFood = await nutritionFood.upsert(buildNutritionFoodUpsertArgs(food));
    const existingAliases = await nutritionFoodAlias.findMany({
      where: {
        foodId: savedFood.id,
      },
      select: {
        languageCode: true,
        normalizedAlias: true,
      },
    });

    const existingAliasKeys = new Set(
      existingAliases.map(
        (alias) => `${alias.languageCode}:${alias.normalizedAlias}`,
      ),
    );

    for (const aliasData of buildNutritionFoodAliasCreateData(savedFood.id, food)) {
      const key = `${aliasData.languageCode}:${aliasData.normalizedAlias}`;

      if (existingAliasKeys.has(key)) {
        continue;
      }

      await nutritionFoodAlias.create({
        data: aliasData,
      });
    }
  }
}

export function buildNutritionFoodUpsertArgs(
  food: SeedFood,
): Prisma.NutritionFoodUpsertArgs {
  const data = {
    nameRu: food.nameRu,
    nameEn: food.nameEn,
    category: food.category,
    caloriesPer100g: food.caloriesPer100g,
    proteinPer100g: food.proteinPer100g,
    fatPer100g: food.fatPer100g,
    carbsPer100g: food.carbsPer100g,
    ...foodCatalogSource,
  };

  return {
    where: {
      slug: food.slug,
    },
    create: {
      slug: food.slug,
      baseAmount: 100,
      baseUnit: "g",
      ...data,
    },
    update: data,
  };
}

export function buildNutritionFoodAliasCreateData(
  foodId: string,
  food: SeedFood,
): Prisma.NutritionFoodAliasCreateInput[] {
  return Object.entries(food.aliases).flatMap(([languageCode, aliases]) =>
    aliases.map((alias) => ({
      food: {
        connect: {
          id: foodId,
        },
      },
      alias,
      languageCode,
      normalizedAlias: normalizeFoodText(alias),
    })),
  );
}
