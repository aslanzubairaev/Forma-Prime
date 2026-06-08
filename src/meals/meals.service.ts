import type { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import type { CalculatedMeal, CalculatedMealTotals } from "../nutrition/food.types.js";
import { getUserTimeZone, getZonedDayRange } from "../time/timezone.js";

export type CreateMealEntryInput = {
  userId: string;
  telegramUserId: bigint;
  rawText: string;
  meal: CalculatedMeal;
  consumedAt?: Date;
};

export type DailyNutritionSummary = {
  totals: CalculatedMealTotals;
  targets: {
    caloriesTarget: number;
    proteinTargetG: number;
    fatTargetG: number;
    carbsTargetG: number;
  } | null;
};

export async function createMealEntry(input: CreateMealEntryInput) {
  return prisma.mealEntry.create({
    data: buildMealEntryCreateData(input),
    include: {
      items: true,
    },
  });
}

export function buildMealEntryCreateData(
  input: CreateMealEntryInput,
): Prisma.MealEntryCreateInput {
  return {
    user: {
      connect: {
        id: input.userId,
      },
    },
    telegramUserId: input.telegramUserId,
    consumedAt: input.consumedAt ?? new Date(),
    rawText: input.rawText,
    totalCalories: input.meal.totals.calories,
    totalProteinG: input.meal.totals.proteinG,
    totalFatG: input.meal.totals.fatG,
    totalCarbsG: input.meal.totals.carbsG,
    items: {
      create: input.meal.items.map((item) => ({
        food: {
          connect: {
            id: item.food.id,
          },
        },
        matchedName: item.matchedName,
        quantity: item.quantity,
        unit: item.unit,
        grams: item.grams,
        calories: item.calories,
        proteinG: item.proteinG,
        fatG: item.fatG,
        carbsG: item.carbsG,
      })),
    },
  };
}

export async function getDailyNutritionSummary(
  userId: string,
  date: Date = new Date(),
  timeZone?: string,
): Promise<DailyNutritionSummary> {
  const { start, end } = await getUserDayRange(userId, date, timeZone);
  const [totals, target] = await Promise.all([
    prisma.mealEntry.aggregate({
      where: {
        userId,
        consumedAt: {
          gte: start,
          lt: end,
        },
      },
      _sum: {
        totalCalories: true,
        totalProteinG: true,
        totalFatG: true,
        totalCarbsG: true,
      },
    }),
    prisma.nutritionTarget.findUnique({
      where: {
        userId,
      },
    }),
  ]);

  return {
    totals: {
      calories: Number(totals._sum.totalCalories ?? 0),
      proteinG: Number(totals._sum.totalProteinG ?? 0),
      fatG: Number(totals._sum.totalFatG ?? 0),
      carbsG: Number(totals._sum.totalCarbsG ?? 0),
    },
    targets: target
      ? {
          caloriesTarget: target.caloriesTarget,
          proteinTargetG: target.proteinTargetG,
          fatTargetG: target.fatTargetG,
          carbsTargetG: target.carbsTargetG,
        }
      : null,
  };
}

export async function getMealsToday(
  userId: string,
  date: Date = new Date(),
  timeZone?: string,
) {
  const { start, end } = await getUserDayRange(userId, date, timeZone);

  return prisma.mealEntry.findMany({
    where: {
      userId,
      consumedAt: {
        gte: start,
        lt: end,
      },
    },
    include: {
      items: true,
    },
    orderBy: {
      consumedAt: "asc",
    },
  });
}

export function sumDailyTotals(
  meals: Array<{
    totalCalories: unknown;
    totalProteinG: unknown;
    totalFatG: unknown;
    totalCarbsG: unknown;
  }>,
): CalculatedMealTotals {
  return meals.reduce<CalculatedMealTotals>(
    (totals, meal) => ({
      calories: totals.calories + Number(meal.totalCalories),
      proteinG: totals.proteinG + Number(meal.totalProteinG),
      fatG: totals.fatG + Number(meal.totalFatG),
      carbsG: totals.carbsG + Number(meal.totalCarbsG),
    }),
    {
      calories: 0,
      proteinG: 0,
      fatG: 0,
      carbsG: 0,
    },
  );
}

export async function getUserDayRange(
  userId: string,
  date: Date = new Date(),
  timeZone?: string,
): Promise<{ start: Date; end: Date }> {
  return getZonedDayRange(date, timeZone ?? (await getUserTimeZone(userId)));
}
