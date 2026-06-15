import prismaClientPkg from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";

const {
  ActivityLevel,
  BodyweightCheckinSource,
  CheckinStatusLabel,
  ConversationStep,
  Gender,
  GoalType,
  Prisma,
  PrismaClient,
  ReminderType,
  WorkoutSessionStatus,
} = prismaClientPkg as typeof PrismaClientModule;

export {
  ActivityLevel,
  BodyweightCheckinSource,
  CheckinStatusLabel,
  ConversationStep,
  Gender,
  GoalType,
  Prisma,
  PrismaClient,
  ReminderType,
  WorkoutSessionStatus,
};
