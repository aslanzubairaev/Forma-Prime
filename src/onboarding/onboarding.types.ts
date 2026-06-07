import type { ActivityLevel, Gender, GoalType } from "@prisma/client";

import type { SupportedLanguage } from "../i18n/index.js";

export type CompleteOnboardingPayload = {
  preferredLanguage: SupportedLanguage;
  gender: Gender;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  trainingDaysPerWeek: number;
};

export type PartialOnboardingPayload = Partial<CompleteOnboardingPayload>;
