CREATE TYPE "BodyweightCheckinSource" AS ENUM ('MANUAL', 'WEEKLY_CHECKIN');

CREATE TYPE "CheckinStatusLabel" AS ENUM ('ON_TRACK', 'NEEDS_CONSISTENCY', 'INSUFFICIENT_DATA');

ALTER TYPE "ConversationStep" ADD VALUE 'WEIGHT_ENTRY';
ALTER TYPE "ConversationStep" ADD VALUE 'CHECKIN_WEIGHT';
ALTER TYPE "ConversationStep" ADD VALUE 'CHECKIN_NUTRITION';
ALTER TYPE "ConversationStep" ADD VALUE 'CHECKIN_TRAINING';
ALTER TYPE "ConversationStep" ADD VALUE 'CHECKIN_ENERGY';
ALTER TYPE "ConversationStep" ADD VALUE 'CHECKIN_NOTES';

ALTER TABLE "BodyweightCheckin"
ADD COLUMN "source" "BodyweightCheckinSource" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "WeeklyCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "nutritionAdherence" INTEGER NOT NULL,
    "trainingAdherence" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "notes" TEXT,
    "statusLabel" "CheckinStatusLabel" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyCheckin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyCheckin_userId_weekStartDate_idx" ON "WeeklyCheckin"("userId", "weekStartDate");

ALTER TABLE "WeeklyCheckin"
ADD CONSTRAINT "WeeklyCheckin_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
