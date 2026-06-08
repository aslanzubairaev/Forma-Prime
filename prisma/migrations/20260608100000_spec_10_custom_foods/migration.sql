CREATE TABLE "CustomFood" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "caloriesPer100g" DECIMAL(8,2) NOT NULL,
    "proteinPer100g" DECIMAL(8,2) NOT NULL,
    "fatPer100g" DECIMAL(8,2) NOT NULL,
    "carbsPer100g" DECIMAL(8,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFood_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MealEntryItem" ADD COLUMN "customFoodId" TEXT;
ALTER TABLE "MealEntryItem" ALTER COLUMN "foodId" DROP NOT NULL;

CREATE UNIQUE INDEX "CustomFood_userId_normalizedName_key" ON "CustomFood"("userId", "normalizedName");
CREATE INDEX "CustomFood_userId_isActive_idx" ON "CustomFood"("userId", "isActive");
CREATE INDEX "MealEntryItem_customFoodId_idx" ON "MealEntryItem"("customFoodId");

ALTER TABLE "CustomFood" ADD CONSTRAINT "CustomFood_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealEntryItem" ADD CONSTRAINT "MealEntryItem_customFoodId_fkey" FOREIGN KEY ("customFoodId") REFERENCES "CustomFood"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
