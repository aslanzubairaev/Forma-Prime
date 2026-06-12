CREATE TABLE "FoodPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerInput" TEXT NOT NULL,
    "normalizedTriggerInput" TEXT NOT NULL,
    "preferredCanonicalName" TEXT NOT NULL,
    "preferredDisplayName" TEXT NOT NULL,
    "preferredFoodSlug" TEXT NOT NULL,
    "preferredServingGrams" DECIMAL(10,2),
    "preferenceKind" TEXT NOT NULL DEFAULT 'clarification_choice',
    "confirmationCount" INTEGER NOT NULL DEFAULT 1,
    "lastConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FoodPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodPreference_userId_normalizedTriggerInput_preferenceKind_key" ON "FoodPreference"("userId", "normalizedTriggerInput", "preferenceKind");

CREATE INDEX "FoodPreference_userId_normalizedTriggerInput_isActive_idx" ON "FoodPreference"("userId", "normalizedTriggerInput", "isActive");

ALTER TABLE "FoodPreference" ADD CONSTRAINT "FoodPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
