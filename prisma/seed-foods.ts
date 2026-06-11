import { disconnectPrisma } from "../src/db/prisma.js";
import {
  ensureEssentialNutritionFoodsSeeded,
  essentialSeedFoods,
} from "../src/nutrition/food-catalog.seed.js";

ensureEssentialNutritionFoodsSeeded()
  .then(async () => {
    console.info(`Seeded ${essentialSeedFoods.length} nutrition foods.`);
    await disconnectPrisma();
  })
  .catch(async (error: unknown) => {
    console.error("Food seed failed", error);
    await disconnectPrisma();
    process.exitCode = 1;
  });
