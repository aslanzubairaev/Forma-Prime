import type { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import type {
  CalculatedMeal,
  CalculatedMealTotals,
  RecentFood,
} from "../nutrition/food.types.js";
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

export type LatestMealEntry = Prisma.MealEntryGetPayload<{
  include: {
    items: true;
  };
}>;

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
      create: buildMealEntryItemCreateData(input.meal),
    },
  };
}

export function buildMealEntryUpdateData(input: {
  rawText: string;
  meal: CalculatedMeal;
}): Prisma.MealEntryUpdateInput {
  return {
    rawText: input.rawText,
    totalCalories: input.meal.totals.calories,
    totalProteinG: input.meal.totals.proteinG,
    totalFatG: input.meal.totals.fatG,
    totalCarbsG: input.meal.totals.carbsG,
    items: {
      create: buildMealEntryItemCreateData(input.meal),
    },
  };
}

function buildMealEntryItemCreateData(
  meal: CalculatedMeal,
): Prisma.MealEntryItemCreateWithoutMealEntryInput[] {
  return meal.items.map((item) => {
    const data: Prisma.MealEntryItemCreateWithoutMealEntryInput = {
      matchedName: item.matchedName,
      quantity: item.quantity,
      unit: item.unit,
      grams: item.grams,
      calories: item.calories,
      proteinG: item.proteinG,
      fatG: item.fatG,
      carbsG: item.carbsG,
    };

    if (item.food.isCustom) {
      data.customFood = {
        connect: {
          id: item.food.id,
        },
      };
    } else {
      data.food = {
        connect: {
          id: item.food.id,
        },
      };
    }

    return data;
  });
}

export async function getLatestMealEntry(
  userId: string,
): Promise<LatestMealEntry | null> {
  return prisma.mealEntry.findFirst({
    where: {
      userId,
    },
    include: {
      items: true,
    },
    orderBy: [
      {
        consumedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });
}

export async function updateLatestMealEntry(input: {
  userId: string;
  mealEntryId: string;
  rawText: string;
  meal: CalculatedMeal;
}): Promise<LatestMealEntry | null> {
  const latest = await getLatestMealEntry(input.userId);

  if (latest?.id !== input.mealEntryId) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    await tx.mealEntryItem.deleteMany({
      where: {
        mealEntryId: input.mealEntryId,
        mealEntry: {
          userId: input.userId,
        },
      },
    });

    return tx.mealEntry.update({
      where: {
        id: input.mealEntryId,
      },
      data: buildMealEntryUpdateData({
        rawText: input.rawText,
        meal: input.meal,
      }),
      include: {
        items: true,
      },
    });
  });
}

export async function deleteLatestMealEntry(input: {
  userId: string;
  mealEntryId: string;
}): Promise<boolean> {
  const latest = await getLatestMealEntry(input.userId);

  if (latest?.id !== input.mealEntryId) {
    return false;
  }

  const result = await prisma.mealEntry.deleteMany({
    where: {
      id: input.mealEntryId,
      userId: input.userId,
    },
  });

  return result.count === 1;
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

export async function getRecentFoods(
  userId: string,
  limit = 5,
): Promise<RecentFood[]> {
  const items = await prisma.mealEntryItem.findMany({
    where: {
      mealEntry: {
        userId,
      },
      OR: [
        {
          foodId: {
            not: null,
          },
        },
        {
          customFoodId: {
            not: null,
          },
        },
      ],
    },
    include: {
      mealEntry: true,
    },
    orderBy: [
      {
        mealEntry: {
          consumedAt: "desc",
        },
      },
      {
        createdAt: "desc",
      },
    ],
    take: 50,
  });
  return selectRecentFoodsFromItems(items, limit);
}

export function selectRecentFoodsFromItems(
  items: Array<{
    id: string;
    foodId: string | null;
    customFoodId: string | null;
    matchedName: string;
    grams: unknown;
    calories: unknown;
    proteinG: unknown;
    fatG: unknown;
    carbsG: unknown;
    mealEntry: {
      consumedAt: Date;
    };
  }>,
  limit = 5,
): RecentFood[] {
  const seen = new Set<string>();
  const result: RecentFood[] = [];

  for (const item of items) {
    const key = item.customFoodId
      ? `custom:${item.customFoodId}`
      : `food:${item.foodId}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      id: item.id,
      name: item.matchedName,
      grams: Number(item.grams),
      calories: Number(item.calories),
      proteinG: Number(item.proteinG),
      fatG: Number(item.fatG),
      carbsG: Number(item.carbsG),
      consumedAt: item.mealEntry.consumedAt,
    });

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export async function quickRelogMeal(input: {
  userId: string;
  telegramUserId: bigint;
  mealEntryItemId: string;
  consumedAt?: Date;
}) {
  const item = await prisma.mealEntryItem.findFirst({
    where: {
      id: input.mealEntryItemId,
      mealEntry: {
        userId: input.userId,
      },
    },
  });

  if (!item || (!item.foodId && !item.customFoodId)) {
    return null;
  }

  const createDataInput: {
    userId: string;
    telegramUserId: bigint;
    sourceItem: MealEntryItemMacroSource;
    consumedAt?: Date;
  } = {
    userId: input.userId,
    telegramUserId: input.telegramUserId,
    sourceItem: item,
  };

  if (input.consumedAt !== undefined) {
    createDataInput.consumedAt = input.consumedAt;
  }

  return prisma.mealEntry.create({
    data: buildQuickRelogMealEntryCreateData(createDataInput),
    include: {
      items: true,
    },
  });
}

type DecimalInput = Prisma.Decimal | number | string;

type MealEntryItemMacroSource = {
  foodId: string | null;
  customFoodId: string | null;
  matchedName: string;
  quantity: DecimalInput;
  unit: string;
  grams: DecimalInput;
  calories: DecimalInput;
  proteinG: DecimalInput;
  fatG: DecimalInput;
  carbsG: DecimalInput;
};

export function buildQuickRelogMealEntryCreateData(input: {
  userId: string;
  telegramUserId: bigint;
  sourceItem: MealEntryItemMacroSource;
  consumedAt?: Date;
}): Prisma.MealEntryCreateInput {
  const itemData: Prisma.MealEntryItemCreateWithoutMealEntryInput = {
    matchedName: input.sourceItem.matchedName,
    quantity: input.sourceItem.quantity,
    unit: input.sourceItem.unit,
    grams: input.sourceItem.grams,
    calories: input.sourceItem.calories,
    proteinG: input.sourceItem.proteinG,
    fatG: input.sourceItem.fatG,
    carbsG: input.sourceItem.carbsG,
  };

  if (input.sourceItem.customFoodId) {
    itemData.customFood = {
      connect: {
        id: input.sourceItem.customFoodId,
      },
    };
  } else if (input.sourceItem.foodId) {
    itemData.food = {
      connect: {
        id: input.sourceItem.foodId,
      },
    };
  }

  return {
    user: {
      connect: {
        id: input.userId,
      },
    },
    telegramUserId: input.telegramUserId,
    consumedAt: input.consumedAt ?? new Date(),
    rawText: `relog:${input.sourceItem.matchedName}`,
    totalCalories: input.sourceItem.calories,
    totalProteinG: input.sourceItem.proteinG,
    totalFatG: input.sourceItem.fatG,
    totalCarbsG: input.sourceItem.carbsG,
    items: {
      create: [itemData],
    },
  };
}

export async function getUserDayRange(
  userId: string,
  date: Date = new Date(),
  timeZone?: string,
): Promise<{ start: Date; end: Date }> {
  return getZonedDayRange(date, timeZone ?? (await getUserTimeZone(userId)));
}
