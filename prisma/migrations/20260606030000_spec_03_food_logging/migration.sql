CREATE TABLE "NutritionFood" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "baseAmount" INTEGER NOT NULL DEFAULT 100,
    "baseUnit" TEXT NOT NULL DEFAULT 'g',
    "caloriesPer100g" DECIMAL(8,2) NOT NULL,
    "proteinPer100g" DECIMAL(8,2) NOT NULL,
    "fatPer100g" DECIMAL(8,2) NOT NULL,
    "carbsPer100g" DECIMAL(8,2) NOT NULL,
    "sourceType" TEXT,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionFood_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NutritionFoodAlias" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionFoodAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawText" TEXT NOT NULL,
    "totalCalories" DECIMAL(10,2) NOT NULL,
    "totalProteinG" DECIMAL(10,2) NOT NULL,
    "totalFatG" DECIMAL(10,2) NOT NULL,
    "totalCarbsG" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealEntryItem" (
    "id" TEXT NOT NULL,
    "mealEntryId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "matchedName" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "grams" DECIMAL(10,2) NOT NULL,
    "calories" DECIMAL(10,2) NOT NULL,
    "proteinG" DECIMAL(10,2) NOT NULL,
    "fatG" DECIMAL(10,2) NOT NULL,
    "carbsG" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealEntryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NutritionFood_slug_key" ON "NutritionFood"("slug");
CREATE INDEX "NutritionFoodAlias_foodId_idx" ON "NutritionFoodAlias"("foodId");
CREATE INDEX "NutritionFoodAlias_normalizedAlias_idx" ON "NutritionFoodAlias"("normalizedAlias");
CREATE INDEX "MealEntry_userId_consumedAt_idx" ON "MealEntry"("userId", "consumedAt");
CREATE INDEX "MealEntryItem_mealEntryId_idx" ON "MealEntryItem"("mealEntryId");
CREATE INDEX "MealEntryItem_foodId_idx" ON "MealEntryItem"("foodId");

ALTER TABLE "NutritionFoodAlias" ADD CONSTRAINT "NutritionFoodAlias_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "NutritionFood"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealEntryItem" ADD CONSTRAINT "MealEntryItem_mealEntryId_fkey" FOREIGN KEY ("mealEntryId") REFERENCES "MealEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealEntryItem" ADD CONSTRAINT "MealEntryItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "NutritionFood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
