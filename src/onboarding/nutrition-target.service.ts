import { ActivityLevel, Gender, GoalType } from "@prisma/client";

import type { CompleteOnboardingPayload } from "./onboarding.types.js";

export const nutritionCalculationMethod = "MIFFLIN_ST_JEOR";

export type CalculatedNutritionTargets = {
  caloriesTarget: number;
  proteinTargetG: number;
  fatTargetG: number;
  carbsTargetG: number;
  goalType: GoalType;
  calculationMethod: typeof nutritionCalculationMethod;
  isActive: true;
};

const activityMultiplierByLevel: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.HIGH]: 1.725,
};

const goalCaloriesMultiplierByGoal: Record<GoalType, number> = {
  [GoalType.FAT_LOSS]: 0.85,
  [GoalType.MAINTENANCE]: 1,
  [GoalType.MUSCLE_GAIN]: 1.1,
  [GoalType.RECOMPOSITION]: 0.9,
};

export function calculateNutritionTargets(
  payload: CompleteOnboardingPayload,
): CalculatedNutritionTargets {
  const bmr =
    10 * payload.currentWeightKg +
    6.25 * payload.heightCm -
    5 * payload.age +
    (payload.gender === Gender.MALE ? 5 : -161);

  const tdee = bmr * activityMultiplierByLevel[payload.activityLevel];
  const caloriesTarget = roundToNearest50(
    tdee * goalCaloriesMultiplierByGoal[payload.goalType],
  );
  const proteinTargetG = Math.round(2 * payload.currentWeightKg);
  const fatTargetG = Math.round(0.8 * payload.currentWeightKg);
  const carbsTargetG = Math.max(
    0,
    Math.round((caloriesTarget - proteinTargetG * 4 - fatTargetG * 9) / 4),
  );

  return {
    caloriesTarget,
    proteinTargetG,
    fatTargetG,
    carbsTargetG,
    goalType: payload.goalType,
    calculationMethod: nutritionCalculationMethod,
    isActive: true,
  };
}

function roundToNearest50(value: number): number {
  return Math.round(value / 50) * 50;
}
