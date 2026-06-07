import { prisma } from "../db/prisma.js";

export async function getActiveNutritionFoods() {
  return prisma.nutritionFood.findMany({
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
}
