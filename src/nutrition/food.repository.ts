import { prisma } from "../db/prisma.js";

export async function getActiveNutritionFoods(userId?: string) {
  const foods = await prisma.nutritionFood.findMany({
    where: {
      isActive: true,
    },
    include: {
      aliases: true,
    },
    orderBy: {
      slug: "asc",
    },
  });

  if (!userId) {
    return foods;
  }

  const customFoods = await prisma.customFood.findMany({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return [
    ...foods,
    ...customFoods.map((food) => ({
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
    })),
  ];
}
