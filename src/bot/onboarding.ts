import type {
  ActivityLevel as ActivityLevelType,
  ConversationStep as ConversationStepType,
  Gender as GenderType,
  GoalType as GoalTypeType,
} from "@prisma/client";
import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";

import {
  getConversationState,
  resetConversationState,
  setConversationState,
} from "../conversation/conversation-state.service.js";
import type { ConversationPayload } from "../conversation/conversation-state.types.js";
import {
  ActivityLevel,
  ConversationStep,
  Gender,
  GoalType,
} from "../db/prisma-client.js";
import {
  isSupportedLanguage,
  normalizeLanguage,
  t,
  type SupportedLanguage,
} from "../i18n/index.js";
import {
  completeOnboarding,
  getProfileByUserId,
  savePreferredLanguage,
} from "../onboarding/onboarding.service.js";
import {
  calculateNutritionTargets,
  type CalculatedNutritionTargets,
} from "../onboarding/nutrition-target.service.js";
import type {
  CompleteOnboardingPayload,
  PartialOnboardingPayload,
} from "../onboarding/onboarding.types.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { replyWithMainMenu } from "./menu.js";

const onboardingActionPattern = /^onboarding:(language|gender|activity|goal|confirm)(?::.+)?$/;

const genderOptions = [Gender.MALE, Gender.FEMALE] as const;
const activityOptions = [
  ActivityLevel.SEDENTARY,
  ActivityLevel.LIGHT,
  ActivityLevel.MODERATE,
  ActivityLevel.HIGH,
] as const;
const goalOptions = [
  GoalType.FAT_LOSS,
  GoalType.MAINTENANCE,
  GoalType.MUSCLE_GAIN,
  GoalType.RECOMPOSITION,
] as const;

const onboardingSteps = new Set<ConversationStepType>([
  ConversationStep.ONBOARDING_LANGUAGE,
  ConversationStep.ONBOARDING_GENDER,
  ConversationStep.ONBOARDING_AGE,
  ConversationStep.ONBOARDING_HEIGHT,
  ConversationStep.ONBOARDING_WEIGHT,
  ConversationStep.ONBOARDING_ACTIVITY,
  ConversationStep.ONBOARDING_GOAL,
  ConversationStep.ONBOARDING_TRAINING_DAYS,
  ConversationStep.ONBOARDING_CONFIRMATION,
]);

const genderLabelKey: Record<GenderType, Parameters<typeof t>[1]> = {
  [Gender.MALE]: "option.gender.male",
  [Gender.FEMALE]: "option.gender.female",
  [Gender.OTHER]: "option.gender.other",
  [Gender.UNSPECIFIED]: "option.gender.unspecified",
};

const activityLabelKey: Record<ActivityLevelType, Parameters<typeof t>[1]> = {
  [ActivityLevel.SEDENTARY]: "option.activity.sedentary",
  [ActivityLevel.LIGHT]: "option.activity.light",
  [ActivityLevel.MODERATE]: "option.activity.moderate",
  [ActivityLevel.HIGH]: "option.activity.high",
};

const goalLabelKey: Record<GoalTypeType, Parameters<typeof t>[1]> = {
  [GoalType.FAT_LOSS]: "option.goal.fatLoss",
  [GoalType.MAINTENANCE]: "option.goal.maintenance",
  [GoalType.MUSCLE_GAIN]: "option.goal.muscleGain",
  [GoalType.RECOMPOSITION]: "option.goal.recomposition",
};

const languageLabelKey: Record<SupportedLanguage, Parameters<typeof t>[1]> = {
  en: "language.english",
  ru: "language.russian",
};

export function registerOnboardingHandlers(bot: Bot): void {
  bot.callbackQuery(onboardingActionPattern, handleOnboardingCallback);
  bot.on("message:text", handleOnboardingText);
}

export async function beginOrResumeOnboarding(
  ctx: Context,
  userId: string,
  fallbackLanguage: SupportedLanguage,
): Promise<void> {
  const state = await getConversationState(userId);

  if (onboardingSteps.has(state.step)) {
    await askForStep(
      ctx,
      state.step,
      readOnboardingPayload(state.payload),
      fallbackLanguage,
    );
    return;
  }

  await setConversationState(userId, ConversationStep.ONBOARDING_LANGUAGE, {});
  await askForStep(ctx, ConversationStep.ONBOARDING_LANGUAGE, {}, fallbackLanguage);
}

async function handleOnboardingCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const fallbackLanguage = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );

  if (profile?.onboardingCompletedAt) {
    await replyWithMainMenu(ctx, fallbackLanguage);
    return;
  }

  const callbackData = ctx.callbackQuery?.data;
  const [, action, value] = callbackData?.split(":") ?? [];
  const state = await getConversationState(user.id);
  const payload = readOnboardingPayload(state.payload);
  const language = payload.preferredLanguage ?? fallbackLanguage;

  if (!onboardingSteps.has(state.step)) {
    await beginOrResumeOnboarding(ctx, user.id, fallbackLanguage);
    return;
  }

  if (action === "language" && state.step === ConversationStep.ONBOARDING_LANGUAGE) {
    if (!value || !isSupportedLanguage(value)) {
      await askForStep(ctx, state.step, payload, fallbackLanguage);
      return;
    }

    const nextPayload = { ...payload, preferredLanguage: value };
    await savePreferredLanguage(user.id, value);
    await advanceOnboarding(
      user.id,
      ConversationStep.ONBOARDING_GENDER,
      nextPayload,
    );
    await askForStep(ctx, ConversationStep.ONBOARDING_GENDER, nextPayload, value);
    return;
  }

  if (action === "gender" && state.step === ConversationStep.ONBOARDING_GENDER) {
    if (!isGender(value) || !genderOptions.some((gender) => gender === value)) {
      await askForStep(ctx, state.step, payload, language);
      return;
    }

    const nextPayload = { ...payload, gender: value };
    await advanceOnboarding(user.id, ConversationStep.ONBOARDING_AGE, nextPayload);
    await askForStep(ctx, ConversationStep.ONBOARDING_AGE, nextPayload, language);
    return;
  }

  if (action === "activity" && state.step === ConversationStep.ONBOARDING_ACTIVITY) {
    if (!isActivityLevel(value)) {
      await askForStep(ctx, state.step, payload, language);
      return;
    }

    const nextPayload = { ...payload, activityLevel: value };
    await advanceOnboarding(user.id, ConversationStep.ONBOARDING_GOAL, nextPayload);
    await askForStep(ctx, ConversationStep.ONBOARDING_GOAL, nextPayload, language);
    return;
  }

  if (action === "goal" && state.step === ConversationStep.ONBOARDING_GOAL) {
    if (!isGoalType(value)) {
      await askForStep(ctx, state.step, payload, language);
      return;
    }

    const nextPayload = { ...payload, goalType: value };
    await advanceOnboarding(
      user.id,
      ConversationStep.ONBOARDING_TRAINING_DAYS,
      nextPayload,
    );
    await askForStep(
      ctx,
      ConversationStep.ONBOARDING_TRAINING_DAYS,
      nextPayload,
      language,
    );
    return;
  }

  if (action === "confirm" && state.step === ConversationStep.ONBOARDING_CONFIRMATION) {
    if (!isCompleteOnboardingPayload(payload)) {
      const nextStep = getEarliestMissingOnboardingStep(payload);

      await ctx.reply(t(language, "validation.incompleteProfile"));
      await advanceOnboarding(user.id, nextStep, payload);
      await askForStep(ctx, nextStep, payload, language);
      return;
    }

    const nutritionTargets = calculateNutritionTargets(payload);

    await completeOnboarding(user.id, payload, nutritionTargets);
    await resetConversationState(user.id);
    await ctx.reply(t(language, "onboarding.completed"));
    await replyWithMainMenu(ctx, language);
    return;
  }

  await ctx.reply(t(language, "common.useCurrentQuestion"));
  await askForStep(ctx, state.step, payload, language);
}

async function handleOnboardingText(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    await next();
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const state = await getConversationState(user.id);

  if (!onboardingSteps.has(state.step)) {
    await next();
    return;
  }

  const profile = await getProfileByUserId(user.id);
  const fallbackLanguage = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );
  const payload = readOnboardingPayload(state.payload);
  const language = payload.preferredLanguage ?? fallbackLanguage;
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) {
    await next();
    return;
  }

  if (state.step === ConversationStep.ONBOARDING_AGE) {
    const age = parseIntegerInRange(text, 12, 80);

    if (age === null) {
      await ctx.reply(t(language, "validation.age"));
      await askForStep(ctx, state.step, payload, language);
      return;
    }

    const nextPayload = { ...payload, age };
    await advanceOnboarding(user.id, ConversationStep.ONBOARDING_HEIGHT, nextPayload);
    await askForStep(ctx, ConversationStep.ONBOARDING_HEIGHT, nextPayload, language);
    return;
  }

  if (state.step === ConversationStep.ONBOARDING_HEIGHT) {
    const heightCm = parseIntegerInRange(text, 120, 230);

    if (heightCm === null) {
      await ctx.reply(t(language, "validation.height"));
      await askForStep(ctx, state.step, payload, language);
      return;
    }

    const nextPayload = { ...payload, heightCm };
    await advanceOnboarding(user.id, ConversationStep.ONBOARDING_WEIGHT, nextPayload);
    await askForStep(ctx, ConversationStep.ONBOARDING_WEIGHT, nextPayload, language);
    return;
  }

  if (state.step === ConversationStep.ONBOARDING_WEIGHT) {
    const currentWeightKg = parseNumberInRange(text, 35, 250);

    if (currentWeightKg === null) {
      await ctx.reply(t(language, "validation.weight"));
      await askForStep(ctx, state.step, payload, language);
      return;
    }

    const nextPayload = { ...payload, currentWeightKg };
    await advanceOnboarding(
      user.id,
      ConversationStep.ONBOARDING_ACTIVITY,
      nextPayload,
    );
    await askForStep(ctx, ConversationStep.ONBOARDING_ACTIVITY, nextPayload, language);
    return;
  }

  if (state.step === ConversationStep.ONBOARDING_TRAINING_DAYS) {
    const trainingDaysPerWeek = parseIntegerInRange(text, 0, 14);

    if (trainingDaysPerWeek === null) {
      await ctx.reply(t(language, "validation.trainingDays"));
      await askForStep(ctx, state.step, payload, language);
      return;
    }

    const nextPayload = { ...payload, trainingDaysPerWeek };
    await advanceOnboarding(
      user.id,
      ConversationStep.ONBOARDING_CONFIRMATION,
      nextPayload,
    );
    await askForStep(
      ctx,
      ConversationStep.ONBOARDING_CONFIRMATION,
      nextPayload,
      language,
    );
    return;
  }

  await ctx.reply(t(language, "validation.buttonExpected"));
  await askForStep(ctx, state.step, payload, language);
}

async function askForStep(
  ctx: Context,
  step: ConversationStepType,
  payload: PartialOnboardingPayload,
  fallbackLanguage: SupportedLanguage,
): Promise<void> {
  const language = payload.preferredLanguage ?? fallbackLanguage;

  if (step === ConversationStep.ONBOARDING_LANGUAGE) {
    await ctx.reply(t(language, "onboarding.language.question"), {
      reply_markup: languageKeyboard(),
    });
    return;
  }

  if (step === ConversationStep.ONBOARDING_GENDER) {
    await ctx.reply(t(language, "onboarding.gender.question"), {
      reply_markup: genderKeyboard(language),
    });
    return;
  }

  if (step === ConversationStep.ONBOARDING_AGE) {
    await ctx.reply(t(language, "onboarding.age.question"));
    return;
  }

  if (step === ConversationStep.ONBOARDING_HEIGHT) {
    await ctx.reply(t(language, "onboarding.height.question"));
    return;
  }

  if (step === ConversationStep.ONBOARDING_WEIGHT) {
    await ctx.reply(t(language, "onboarding.weight.question"));
    return;
  }

  if (step === ConversationStep.ONBOARDING_ACTIVITY) {
    await ctx.reply(t(language, "onboarding.activity.question"), {
      reply_markup: activityKeyboard(language),
    });
    return;
  }

  if (step === ConversationStep.ONBOARDING_GOAL) {
    await ctx.reply(t(language, "onboarding.goal.question"), {
      reply_markup: goalKeyboard(language),
    });
    return;
  }

  if (step === ConversationStep.ONBOARDING_TRAINING_DAYS) {
    await ctx.reply(t(language, "onboarding.trainingDays.question"));
    return;
  }

  if (step === ConversationStep.ONBOARDING_CONFIRMATION) {
    if (!isCompleteOnboardingPayload(payload)) {
      await ctx.reply(t(language, "validation.incompleteProfile"));
      return;
    }

    const nutritionTargets = calculateNutritionTargets(payload);

    await ctx.reply(
      [
        t(language, "onboarding.confirmation.question"),
        "",
        buildOnboardingSummary(language, payload, nutritionTargets),
      ].join("\n"),
      {
        reply_markup: confirmationKeyboard(language),
      },
    );
  }
}

function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("en", "language.english"), "onboarding:language:en")
    .text(t("ru", "language.russian"), "onboarding:language:ru");
}

function genderKeyboard(language: SupportedLanguage): InlineKeyboard {
  return genderOptions.reduce(
    (keyboard, gender) =>
      keyboard.text(t(language, genderLabelKey[gender]), `onboarding:gender:${gender}`),
    new InlineKeyboard(),
  );
}

function activityKeyboard(language: SupportedLanguage): InlineKeyboard {
  return activityOptions.reduce(
    (keyboard, activityLevel) =>
      keyboard
        .text(
          t(language, activityLabelKey[activityLevel]),
          `onboarding:activity:${activityLevel}`,
        )
        .row(),
    new InlineKeyboard(),
  );
}

function goalKeyboard(language: SupportedLanguage): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, goalLabelKey[GoalType.FAT_LOSS]), `onboarding:goal:${GoalType.FAT_LOSS}`)
    .text(t(language, goalLabelKey[GoalType.MAINTENANCE]), `onboarding:goal:${GoalType.MAINTENANCE}`)
    .row()
    .text(t(language, goalLabelKey[GoalType.MUSCLE_GAIN]), `onboarding:goal:${GoalType.MUSCLE_GAIN}`)
    .text(t(language, goalLabelKey[GoalType.RECOMPOSITION]), `onboarding:goal:${GoalType.RECOMPOSITION}`);
}

function confirmationKeyboard(language: SupportedLanguage): InlineKeyboard {
  return new InlineKeyboard().text(
    t(language, "onboarding.confirmation.button"),
    "onboarding:confirm",
  );
}

function buildOnboardingSummary(
  language: SupportedLanguage,
  payload: CompleteOnboardingPayload,
  targets: CalculatedNutritionTargets,
): string {
  return [
    t(language, "onboarding.summary.title"),
    `${t(language, "onboarding.summary.language")}: ${t(
      language,
      languageLabelKey[payload.preferredLanguage],
    )}`,
    `${t(language, "onboarding.summary.gender")}: ${t(
      language,
      genderLabelKey[payload.gender],
    )}`,
    `${t(language, "onboarding.summary.age")}: ${payload.age}`,
    `${t(language, "onboarding.summary.height")}: ${payload.heightCm} ${t(
      language,
      "unit.cm",
    )}`,
    `${t(language, "onboarding.summary.weight")}: ${payload.currentWeightKg} ${t(
      language,
      "unit.kg",
    )}`,
    `${t(language, "onboarding.summary.activity")}: ${t(
      language,
      activityLabelKey[payload.activityLevel],
    )}`,
    `${t(language, "onboarding.summary.goal")}: ${t(
      language,
      goalLabelKey[payload.goalType],
    )}`,
    `${t(language, "onboarding.summary.trainingDays")}: ${payload.trainingDaysPerWeek}`,
    `${t(language, "onboarding.summary.calories")}: ${targets.caloriesTarget} ${t(
      language,
      "unit.kcal",
    )}`,
    `${t(language, "onboarding.summary.protein")}: ${targets.proteinTargetG} ${t(
      language,
      "unit.g",
    )}`,
    `${t(language, "onboarding.summary.fat")}: ${targets.fatTargetG} ${t(
      language,
      "unit.g",
    )}`,
    `${t(language, "onboarding.summary.carbs")}: ${targets.carbsTargetG} ${t(
      language,
      "unit.g",
    )}`,
  ].join("\n");
}

function getEarliestMissingOnboardingStep(
  payload: PartialOnboardingPayload,
): ConversationStepType {
  if (payload.preferredLanguage === undefined) {
    return ConversationStep.ONBOARDING_LANGUAGE;
  }

  if (payload.gender === undefined) {
    return ConversationStep.ONBOARDING_GENDER;
  }

  if (payload.age === undefined) {
    return ConversationStep.ONBOARDING_AGE;
  }

  if (payload.heightCm === undefined) {
    return ConversationStep.ONBOARDING_HEIGHT;
  }

  if (payload.currentWeightKg === undefined) {
    return ConversationStep.ONBOARDING_WEIGHT;
  }

  if (payload.activityLevel === undefined) {
    return ConversationStep.ONBOARDING_ACTIVITY;
  }

  if (payload.goalType === undefined) {
    return ConversationStep.ONBOARDING_GOAL;
  }

  if (payload.trainingDaysPerWeek === undefined) {
    return ConversationStep.ONBOARDING_TRAINING_DAYS;
  }

  return ConversationStep.ONBOARDING_CONFIRMATION;
}

async function advanceOnboarding(
  userId: string,
  step: ConversationStepType,
  payload: PartialOnboardingPayload,
): Promise<void> {
  await setConversationState(userId, step, payload as ConversationPayload);
}

function readOnboardingPayload(
  payload: ConversationPayload | null,
): PartialOnboardingPayload {
  const source = payload ?? {};
  const result: PartialOnboardingPayload = {};

  if (
    typeof source.preferredLanguage === "string" &&
    isSupportedLanguage(source.preferredLanguage)
  ) {
    result.preferredLanguage = source.preferredLanguage;
  }

  if (isGender(source.gender)) {
    result.gender = source.gender;
  }

  if (typeof source.age === "number") {
    result.age = source.age;
  }

  if (typeof source.heightCm === "number") {
    result.heightCm = source.heightCm;
  }

  if (typeof source.currentWeightKg === "number") {
    result.currentWeightKg = source.currentWeightKg;
  }

  if (isActivityLevel(source.activityLevel)) {
    result.activityLevel = source.activityLevel;
  }

  if (isGoalType(source.goalType)) {
    result.goalType = source.goalType;
  }

  if (typeof source.trainingDaysPerWeek === "number") {
    result.trainingDaysPerWeek = source.trainingDaysPerWeek;
  }

  return result;
}

function isCompleteOnboardingPayload(
  payload: PartialOnboardingPayload,
): payload is CompleteOnboardingPayload {
  return (
    payload.preferredLanguage !== undefined &&
    payload.gender !== undefined &&
    payload.age !== undefined &&
    payload.heightCm !== undefined &&
    payload.currentWeightKg !== undefined &&
    payload.activityLevel !== undefined &&
    payload.goalType !== undefined &&
    payload.trainingDaysPerWeek !== undefined
  );
}

function parseIntegerInRange(
  value: string,
  min: number,
  max: number,
): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return parsed >= min && parsed <= max ? parsed : null;
}

function parseNumberInRange(
  value: string,
  min: number,
  max: number,
): number | null {
  const normalizedValue = value.replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    return null;
  }

  const parsed = Number(normalizedValue);
  return parsed >= min && parsed <= max ? parsed : null;
}

function isGender(value: unknown): value is GenderType {
  return typeof value === "string" && Object.values(Gender).includes(value as GenderType);
}

function isActivityLevel(value: unknown): value is ActivityLevelType {
  return (
    typeof value === "string" &&
    Object.values(ActivityLevel).includes(value as ActivityLevelType)
  );
}

function isGoalType(value: unknown): value is GoalTypeType {
  return typeof value === "string" && Object.values(GoalType).includes(value as GoalTypeType);
}
