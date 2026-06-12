CREATE TABLE "LearnedFoodCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "rawInput" TEXT NOT NULL,
    "normalizedInput" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT,
    "servingGrams" DECIMAL(10,2),
    "caloriesPer100g" DECIMAL(8,2) NOT NULL,
    "proteinPer100g" DECIMAL(8,2) NOT NULL,
    "fatPer100g" DECIMAL(8,2) NOT NULL,
    "carbsPer100g" DECIMAL(8,2) NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "isEstimate" BOOLEAN NOT NULL DEFAULT true,
    "aliasesJson" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "LearnedFoodCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearnedFoodCandidate_userId_normalizedInput_key" ON "LearnedFoodCandidate"("userId", "normalizedInput");
CREATE INDEX "LearnedFoodCandidate_normalizedInput_idx" ON "LearnedFoodCandidate"("normalizedInput");
CREATE INDEX "LearnedFoodCandidate_userId_normalizedInput_idx" ON "LearnedFoodCandidate"("userId", "normalizedInput");
CREATE INDEX "LearnedFoodCandidate_rejectedAt_idx" ON "LearnedFoodCandidate"("rejectedAt");

ALTER TABLE "LearnedFoodCandidate" ADD CONSTRAINT "LearnedFoodCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
