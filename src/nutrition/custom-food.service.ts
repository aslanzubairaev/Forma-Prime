import type { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import {
  type CustomFoodInputParseResult,
  type NutritionFoodRecord,
} from "./food.types.js";
import { normalizeFoodText } from "./food-normalization.js";

const minNameLength = 2;
const maxNameLength = 80;
const maxCaloriesPer100g = 1000;
const maxMacroPer100g = 100;

export function parseCustomFoodInput(rawValue: string): CustomFoodInputParseResult {
  const parts = rawValue
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length !== 5) {
    return { status: "invalid" };
  }

  const [name, calories, protein, fat, carbs] = parts;

  if (!name || name.length < minNameLength || name.length > maxNameLength) {
    return { status: "invalid" };
  }

  const caloriesPer100g = parseNumber(calories);
  const proteinPer100g = parseNumber(protein);
  const fatPer100g = parseNumber(fat);
  const carbsPer100g = parseNumber(carbs);

  if (
    caloriesPer100g === null ||
    proteinPer100g === null ||
    fatPer100g === null ||
    carbsPer100g === null ||
    caloriesPer100g < 0 ||
    caloriesPer100g > maxCaloriesPer100g ||
    proteinPer100g < 0 ||
    proteinPer100g > maxMacroPer100g ||
    fatPer100g < 0 ||
    fatPer100g > maxMacroPer100g ||
    carbsPer100g < 0 ||
    carbsPer100g > maxMacroPer100g
  ) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    value: {
      name,
      caloriesPer100g,
      proteinPer100g,
      fatPer100g,
      carbsPer100g,
    },
  };
}

export function buildCustomFoodUpsertData(input: {
  userId: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}): {
  where: Prisma.CustomFoodWhereUniqueInput;
  create: Prisma.CustomFoodCreateInput;
  update: Prisma.CustomFoodUpdateInput;
} {
  const normalizedName = normalizeFoodText(input.name);
  const macroData = {
    name: input.name,
    normalizedName,
    caloriesPer100g: input.caloriesPer100g,
    proteinPer100g: input.proteinPer100g,
    fatPer100g: input.fatPer100g,
    carbsPer100g: input.carbsPer100g,
    isActive: true,
  };

  return {
    where: {
      userId_normalizedName: {
        userId: input.userId,
        normalizedName,
      },
    },
    create: {
      user: {
        connect: {
          id: input.userId,
        },
      },
      ...macroData,
    },
    update: macroData,
  };
}

export async function upsertCustomFood(input: {
  userId: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}) {
  return prisma.customFood.upsert(buildCustomFoodUpsertData(input));
}

export function customFoodToNutritionRecord(food: {
  id: string;
  name: string;
  normalizedName: string;
  caloriesPer100g: unknown;
  proteinPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
}): NutritionFoodRecord {
  return {
    id: food.id,
    slug: `custom-${food.id}`,
    nameRu: food.name,
    nameEn: food.name,
    isCustom: true,
    caloriesPer100g: food.caloriesPer100g,
    proteinPer100g: food.proteinPer100g,
    fatPer100g: food.fatPer100g,
    carbsPer100g: food.carbsPer100g,
    aliases: [
      {
        alias: food.name,
        languageCode: "custom",
        normalizedAlias: food.normalizedName,
      },
    ],
  };
}

function parseNumber(rawValue: string | undefined): number | null {
  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue.replace(",", "."));

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}
