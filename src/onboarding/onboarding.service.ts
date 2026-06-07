import type { Profile } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import type { SupportedLanguage } from "../i18n/index.js";
import {
  calculateNutritionTargets,
  type CalculatedNutritionTargets,
} from "./nutrition-target.service.js";
import type { CompleteOnboardingPayload } from "./onboarding.types.js";

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  return prisma.profile.findUnique({
    where: { userId },
  });
}

export async function savePreferredLanguage(
  userId: string,
  preferredLanguage: SupportedLanguage,
): Promise<void> {
  await prisma.profile.upsert({
    where: { userId },
    create: {
      userId,
      preferredLanguage,
    },
    update: {
      preferredLanguage,
    },
  });
}

export async function completeOnboarding(
  userId: string,
  payload: CompleteOnboardingPayload,
  calculatedNutritionTargets?: CalculatedNutritionTargets,
) {
  const nutritionTargets =
    calculatedNutritionTargets ?? calculateNutritionTargets(payload);

  return prisma.$transaction(async (tx) => {
    const profile = await tx.profile.upsert({
      where: { userId },
      create: {
        userId,
        gender: payload.gender,
        age: payload.age,
        heightCm: payload.heightCm,
        currentWeightKg: payload.currentWeightKg,
        activityLevel: payload.activityLevel,
        goalType: payload.goalType,
        trainingDaysPerWeek: payload.trainingDaysPerWeek,
        preferredLanguage: payload.preferredLanguage,
        onboardingCompletedAt: new Date(),
      },
      update: {
        gender: payload.gender,
        age: payload.age,
        heightCm: payload.heightCm,
        currentWeightKg: payload.currentWeightKg,
        activityLevel: payload.activityLevel,
        goalType: payload.goalType,
        trainingDaysPerWeek: payload.trainingDaysPerWeek,
        preferredLanguage: payload.preferredLanguage,
        onboardingCompletedAt: new Date(),
      },
    });

    const nutritionTarget = await tx.nutritionTarget.upsert({
      where: { userId },
      create: {
        userId,
        ...nutritionTargets,
      },
      update: nutritionTargets,
    });

    return {
      profile,
      nutritionTarget,
    };
  });
}
