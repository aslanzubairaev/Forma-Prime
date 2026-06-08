CREATE TYPE "ReminderType" AS ENUM ('FOOD_LOG', 'WORKOUT_LOG', 'WEEKLY_CHECKIN');

ALTER TYPE "ConversationStep" ADD VALUE 'REMINDER_TYPE';
ALTER TYPE "ConversationStep" ADD VALUE 'REMINDER_ACTION';
ALTER TYPE "ConversationStep" ADD VALUE 'REMINDER_WEEKDAY';
ALTER TYPE "ConversationStep" ADD VALUE 'REMINDER_TIME';

CREATE TABLE "ReminderPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ReminderType" NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "hourLocal" INTEGER NOT NULL,
  "minuteLocal" INTEGER NOT NULL,
  "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "lastSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReminderPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderPreference_userId_type_key"
  ON "ReminderPreference"("userId", "type");

CREATE INDEX "ReminderPreference_userId_idx"
  ON "ReminderPreference"("userId");

CREATE INDEX "ReminderPreference_isEnabled_hourLocal_minuteLocal_idx"
  ON "ReminderPreference"("isEnabled", "hourLocal", "minuteLocal");

ALTER TABLE "ReminderPreference"
  ADD CONSTRAINT "ReminderPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
