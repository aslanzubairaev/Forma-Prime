import { ConversationStep } from "@prisma/client";
import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";

import {
  claimConversationStep,
  getConversationState,
  resetConversationState,
  setConversationState,
} from "../conversation/conversation-state.service.js";
import type { ConversationPayload } from "../conversation/conversation-state.types.js";
import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import {
  createMealEntry,
  deleteLatestMealEntry,
  getDailyNutritionSummary,
  getLatestMealEntry,
  getRecentFoods,
  quickRelogMeal,
  updateLatestMealEntry,
  type DailyNutritionSummary,
  type LatestMealEntry,
} from "../meals/meals.service.js";
import {
  type CalculatedMeal,
  type NutritionFoodRecord,
  type ParsedFoodItemCandidate,
  type RecentFood,
} from "../nutrition/food.types.js";
import {
  parseCustomFoodInput,
  upsertCustomFood,
} from "../nutrition/custom-food.service.js";
import {
  buildClarifiedFoodCandidate,
  detectFoodAmbiguity,
  getFoodClarificationChoice,
  getFoodClarificationChoiceLabel,
  type FoodAmbiguity,
  type FoodAmbiguityKind,
  type FoodClarificationChoice,
} from "../nutrition/food-ambiguity.service.js";
import { matchFoodCandidate } from "../nutrition/food-matcher.js";
import {
  resolveFoodFallback,
  resolveParsedFoodItemWithFallback,
} from "../nutrition/food-fallback-resolver.js";
import { parseFoodLogMessage } from "../nutrition/food-parser.js";
import {
  findActiveFoodPreference,
  foodPreferenceToClarificationChoice,
  incrementFoodPreferenceConfirmation,
  upsertFoodPreference,
  type FoodPreferenceRecord,
} from "../nutrition/food-preference.service.js";
import { getActiveNutritionFoods } from "../nutrition/food.repository.js";
import { calculateMeal, calculateMealItem } from "../nutrition/nutrition-calculator.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { beginOrResumeOnboarding } from "./onboarding.js";

type FoodEntryPayload = {
  rawText: string;
  parsedItems: ParsedFoodItemCandidate[];
  selectedFoodIdsByIndex: Record<string, string>;
};

type FoodAmbiguityPayload = {
  payloadKind: "food_ambiguity";
  rawText: string;
  triggerInput: string;
  normalizedTriggerInput: string;
  ambiguityKind: FoodAmbiguityKind;
};

type FoodPreferenceReusePayload = {
  payloadKind: "food_preference_reuse";
  rawText: string;
  triggerInput: string;
  normalizedTriggerInput: string;
  ambiguityKind: FoodAmbiguityKind;
  preferenceId: string;
};

const foodChoicePattern = /^food:choose:(\d+):(.+)$/;
const foodClarificationPattern = /^food:clarify:([a-z_]+):([a-z_]+)$/;
const foodPreferencePattern = /^food:pref:(yes|clarify)$/;
const foodClarificationOtherAction = "food:clarify:other";
const foodRelogPattern = /^food:relog:(.+)$/;
const lastMealEditPattern = /^lastmeal:edit:(.+)$/;
const lastMealDeletePattern = /^lastmeal:delete:(.+)$/;
const lastMealConfirmDeletePattern = /^lastmeal:confirm_delete:(.+)$/;
const lastMealCancelAction = "lastmeal:cancel";

export function registerFoodLoggingHandlers(bot: Bot): void {
  bot.command("lastmeal", handleLastMealCommand);
  bot.command("customfood", handleCustomFoodCommand);
  bot.command("recentfoods", handleRecentFoodsCommand);
  bot.callbackQuery(foodChoicePattern, handleFoodChoiceCallback);
  bot.callbackQuery(foodClarificationPattern, handleFoodClarificationCallback);
  bot.callbackQuery(foodPreferencePattern, handleFoodPreferenceCallback);
  bot.callbackQuery(foodClarificationOtherAction, handleFoodClarificationOtherCallback);
  bot.callbackQuery(foodRelogPattern, handleFoodRelogCallback);
  bot.callbackQuery(lastMealEditPattern, handleLastMealEditCallback);
  bot.callbackQuery(lastMealDeletePattern, handleLastMealDeleteCallback);
  bot.callbackQuery(lastMealConfirmDeletePattern, handleLastMealConfirmDeleteCallback);
  bot.callbackQuery(lastMealCancelAction, handleLastMealCancelCallback);
  bot.on("message:text", handleFoodText);
}

export function formatDailyTotals(
  language: SupportedLanguage,
  dailySummary: DailyNutritionSummary,
): string {
  const { totals, targets } = dailySummary;

  if (!targets) {
    return [
      t(language, "today.title"),
      t(language, "today.noTargets"),
      formatMacroLine(language, totals),
    ].join("\n");
  }

  return [
    t(language, "today.title"),
    t(language, "today.calories", {
      current: Math.round(totals.calories),
      target: targets.caloriesTarget,
    }),
    t(language, "today.protein", {
      current: Math.round(totals.proteinG),
      target: targets.proteinTargetG,
    }),
    t(language, "today.fat", {
      current: Math.round(totals.fatG),
      target: targets.fatTargetG,
    }),
    t(language, "today.carbs", {
      current: Math.round(totals.carbsG),
      target: targets.carbsTargetG,
    }),
  ].join("\n");
}

async function handleFoodText(ctx: Context, next: NextFunction): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    await next();
    return;
  }

  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    await next();
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );
  const state = await getConversationState(user.id);

  if (state.step === ConversationStep.MEAL_EDIT) {
    await handleMealEditText(ctx, user.id, BigInt(ctx.from.id), language, rawText, state.payload);
    return;
  }

  if (!profile?.onboardingCompletedAt) {
    await beginOrResumeOnboarding(ctx, user.id, language);
    return;
  }

  await processFoodLog(ctx, user.id, BigInt(ctx.from.id), rawText, language);
}

async function handleLastMealCommand(ctx: Context): Promise<void> {
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  const meal = await getLatestMealEntry(identity.userId);

  if (!meal) {
    await ctx.reply(t(identity.language, "lastMeal.empty"));
    return;
  }

  await ctx.reply(formatLatestMeal(identity.language, meal), {
    reply_markup: lastMealKeyboard(identity.language, meal.id),
  });
}

async function handleCustomFoodCommand(ctx: Context): Promise<void> {
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  const rawInput = getCommandArgument(ctx);

  if (!rawInput) {
    await ctx.reply(t(identity.language, "customFood.help"));
    return;
  }

  const parsed = parseCustomFoodInput(rawInput);

  if (parsed.status === "invalid") {
    await ctx.reply(t(identity.language, "customFood.invalid"));
    await ctx.reply(t(identity.language, "customFood.help"));
    return;
  }

  const food = await upsertCustomFood({
    userId: identity.userId,
    ...parsed.value,
  });

  await ctx.reply(t(identity.language, "customFood.saved", { name: food.name }));
}

async function handleRecentFoodsCommand(ctx: Context): Promise<void> {
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  const recentFoods = await getRecentFoods(identity.userId);

  if (recentFoods.length === 0) {
    await ctx.reply(t(identity.language, "recentFoods.empty"));
    return;
  }

  await ctx.reply(formatRecentFoods(identity.language, recentFoods), {
    reply_markup: recentFoodsKeyboard(identity.language, recentFoods),
  });
}

async function handleLastMealEditCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);
  const mealEntryId = ctx.callbackQuery?.data?.match(lastMealEditPattern)?.[1];

  if (!identity || !mealEntryId) {
    return;
  }

  await setConversationState(identity.userId, ConversationStep.MEAL_EDIT, {
    mealEntryId,
  });
  await ctx.reply(t(identity.language, "lastMeal.editPrompt"));
}

async function handleLastMealDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);
  const mealEntryId = ctx.callbackQuery?.data?.match(lastMealDeletePattern)?.[1];

  if (!identity || !mealEntryId) {
    return;
  }

  await setConversationState(identity.userId, ConversationStep.MEAL_DELETE, {
    mealEntryId,
  });
  await ctx.reply(t(identity.language, "lastMeal.deleteConfirm"), {
    reply_markup: lastMealDeleteConfirmKeyboard(identity.language, mealEntryId),
  });
}

async function handleLastMealConfirmDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);
  const mealEntryId = ctx.callbackQuery?.data?.match(lastMealConfirmDeletePattern)?.[1];

  if (!identity || !mealEntryId) {
    return;
  }

  const state = await getConversationState(identity.userId);
  const payload = readLatestMealPayload(state.payload);

  if (state.step !== ConversationStep.MEAL_DELETE || payload?.mealEntryId !== mealEntryId) {
    await ctx.reply(t(identity.language, "lastMeal.expired"));
    return;
  }

  const claimed = await claimConversationStep(identity.userId, ConversationStep.MEAL_DELETE);

  if (!claimed) {
    await ctx.reply(t(identity.language, "lastMeal.expired"));
    return;
  }

  const deleted = await deleteLatestMealEntry({
    userId: identity.userId,
    mealEntryId,
  });

  await ctx.reply(
    deleted
      ? t(identity.language, "lastMeal.deleted")
      : t(identity.language, "lastMeal.expired"),
  );
}

async function handleLastMealCancelCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  await resetConversationState(identity.userId);
  await ctx.reply(t(identity.language, "lastMeal.cancelled"));
}

async function handleFoodChoiceCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );
  const state = await getConversationState(user.id);
  const callbackData = ctx.callbackQuery?.data;
  const match = callbackData?.match(foodChoicePattern);

  if (state.step !== ConversationStep.FOOD_ENTRY || !match) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  const payload = readFoodEntryPayload(state.payload);

  if (!payload) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    await resetConversationState(user.id);
    return;
  }

  const [, rawIndex, foodId] = match;

  if (!rawIndex || !foodId) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  await continueFoodLogWithSelection(
    ctx,
    user.id,
    BigInt(ctx.from.id),
    language,
    {
      ...payload,
      selectedFoodIdsByIndex: {
        ...payload.selectedFoodIdsByIndex,
        [rawIndex]: foodId,
      },
    },
    { requireFoodEntryClaim: true },
  );
}

async function handleFoodClarificationCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );
  const state = await getConversationState(user.id);
  const payload = readFoodAmbiguityPayload(state.payload);
  const callbackMatch = ctx.callbackQuery?.data?.match(foodClarificationPattern);

  if (state.step !== ConversationStep.FOOD_ENTRY || !payload || !callbackMatch) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  const [, rawKind, choiceId] = callbackMatch;

  if (rawKind !== payload.ambiguityKind || !choiceId) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  const choice = getFoodClarificationChoice(payload.ambiguityKind, choiceId);

  if (!choice) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  const claimed = await claimConversationStep(user.id, ConversationStep.FOOD_ENTRY);

  if (!claimed) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  await logClarifiedFoodChoice(ctx, {
    userId: user.id,
    telegramUserId: BigInt(ctx.from.id),
    language,
    rawText: payload.rawText,
    triggerInput: payload.triggerInput,
    choice,
    afterLog: async () => {
      await upsertFoodPreference({
        userId: user.id,
        triggerInput: payload.normalizedTriggerInput,
        choice,
      });
    },
  });
}

async function handleFoodPreferenceCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );
  const state = await getConversationState(user.id);
  const payload = readFoodPreferenceReusePayload(state.payload);
  const action = ctx.callbackQuery?.data?.match(foodPreferencePattern)?.[1];

  if (state.step !== ConversationStep.FOOD_ENTRY || !payload || !action) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  if (action === "clarify") {
    await askFoodClarification(ctx, user.id, language, {
      kind: payload.ambiguityKind,
      triggerInput: payload.triggerInput,
      normalizedTriggerInput: payload.normalizedTriggerInput,
      choices: detectFoodAmbiguity(payload.triggerInput)?.choices ?? [],
    }, payload.rawText);
    return;
  }

  const preference = await findActiveFoodPreference({
    userId: user.id,
    triggerInput: payload.normalizedTriggerInput,
  });

  if (!preference || preference.id !== payload.preferenceId) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  const choice = foodPreferenceToClarificationChoice(preference);

  if (!choice) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  const claimed = await claimConversationStep(user.id, ConversationStep.FOOD_ENTRY);

  if (!claimed) {
    await ctx.reply(t(language, "food.clarificationExpired"));
    return;
  }

  await logClarifiedFoodChoice(ctx, {
    userId: user.id,
    telegramUserId: BigInt(ctx.from.id),
    language,
    rawText: payload.rawText,
    triggerInput: payload.triggerInput,
    choice,
    afterLog: async () => {
      await incrementFoodPreferenceConfirmation(preference);
    },
  });
}

async function handleFoodClarificationOtherCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getFoodIdentity(ctx);

  if (!identity) {
    return;
  }

  await resetConversationState(identity.userId);
  await ctx.reply(t(identity.language, "food.parseFailed"));
}

async function handleFoodRelogCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const identity = await getFoodIdentity(ctx);
  const match = ctx.callbackQuery?.data?.match(foodRelogPattern);
  const mealEntryItemId = match?.[1];

  if (!identity || !mealEntryItemId) {
    return;
  }

  const meal = await quickRelogMeal({
    userId: identity.userId,
    telegramUserId: BigInt(ctx.from.id),
    mealEntryItemId,
  });

  if (!meal) {
    await ctx.reply(t(identity.language, "recentFoods.expired"));
    return;
  }

  const item = meal.items[0];
  const dailySummary = await getDailyNutritionSummary(identity.userId);

  await ctx.reply(
    [
      t(identity.language, "recentFoods.logged", {
        name: item?.matchedName ?? t(identity.language, "recentFoods.itemFallback"),
      }),
      "",
      formatDailyTotals(identity.language, dailySummary),
    ].join("\n"),
  );
}

async function handleMealEditText(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  language: SupportedLanguage,
  rawText: string,
  payload: ConversationPayload | null,
): Promise<void> {
  const editPayload = readLatestMealPayload(payload);

  if (!editPayload) {
    await resetConversationState(userId);
    await ctx.reply(t(language, "lastMeal.expired"));
    return;
  }

  const parsedMeal = await parseDeterministicMealForUser(userId, rawText, language);

  if (parsedMeal.status === "invalid") {
    await ctx.reply(t(language, "lastMeal.editInvalid"));
    return;
  }

  const claimed = await claimConversationStep(userId, ConversationStep.MEAL_EDIT);

  if (!claimed) {
    await ctx.reply(t(language, "lastMeal.expired"));
    return;
  }

  const updated = await updateLatestMealEntry({
    userId,
    mealEntryId: editPayload.mealEntryId,
    rawText,
    meal: parsedMeal.meal,
  });

  if (!updated) {
    await ctx.reply(t(language, "lastMeal.expired"));
    return;
  }

  const dailySummary = await getDailyNutritionSummary(userId);
  await ctx.reply(
    [
      t(language, "lastMeal.updated"),
      "",
      formatMealRecorded(language, parsedMeal.meal, dailySummary),
    ].join("\n"),
  );
}

async function processFoodLog(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  rawText: string,
  language: SupportedLanguage,
): Promise<void> {
  const ambiguity = detectFoodAmbiguity(rawText);

  if (ambiguity) {
    const preference = await findActiveFoodPreference({
      userId,
      triggerInput: ambiguity.normalizedTriggerInput,
    });
    const preferredChoice = preference
      ? foodPreferenceToClarificationChoice(preference)
      : null;

    if (preference && preferredChoice) {
      await askFoodPreferenceReuse(ctx, language, ambiguity, preference, preferredChoice);
      return;
    }

    await askFoodClarification(ctx, userId, language, ambiguity, rawText);
    return;
  }

  const parsed = parseFoodLogMessage(rawText);

  if (parsed.items.length > 0 && parsed.rejectedParts.length === 0) {
    await continueFoodLogWithSelection(ctx, userId, telegramUserId, language, {
      rawText,
      parsedItems: parsed.items,
      selectedFoodIdsByIndex: {},
    });
    return;
  }

  const fallback = await resolveFoodFallback({
    userId,
    rawInput: rawText,
    language,
  });

  if (fallback.status !== "resolved") {
    await ctx.reply(t(language, "food.parseFailed"));
    return;
  }

  const meal = calculateMeal([
    calculateMealItem(
      fallback.food,
      fallback.parsedItem,
      getFoodDisplayName(fallback.food, language),
    ),
  ]);

  await createMealEntry({
    userId,
    telegramUserId,
    rawText,
    meal,
  });

  const dailySummary = await getDailyNutritionSummary(userId);
  await ctx.reply(formatMealRecorded(language, meal, dailySummary));
}

async function parseDeterministicMealForUser(
  userId: string,
  rawText: string,
  language: SupportedLanguage,
): Promise<
  | {
      status: "ok";
      meal: CalculatedMeal;
    }
  | {
      status: "invalid";
    }
> {
  const parsed = parseFoodLogMessage(rawText);

  if (parsed.items.length === 0 || parsed.rejectedParts.length > 0) {
    return { status: "invalid" };
  }

  const foods = await getActiveNutritionFoods(userId);
  const calculatedItems = [];

  for (const item of parsed.items) {
    const match = matchFoodCandidate(item, foods);

    if (match.status !== "matched") {
      return { status: "invalid" };
    }

    calculatedItems.push(
      calculateMealItem(
        match.food,
        item,
        getFoodDisplayName(match.food, language),
      ),
    );
  }

  return {
    status: "ok",
    meal: calculateMeal(calculatedItems),
  };
}

async function continueFoodLogWithSelection(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  language: SupportedLanguage,
  payload: FoodEntryPayload,
  options: { requireFoodEntryClaim?: boolean } = {},
): Promise<void> {
  const foods = await getActiveNutritionFoods(userId);
  const calculatedItems = [];
  const unmatchedItems: ParsedFoodItemCandidate[] = [];

  for (const [index, item] of payload.parsedItems.entries()) {
    const selectedFoodId = payload.selectedFoodIdsByIndex[String(index)];
    const selectedFood = selectedFoodId
      ? foods.find((food) => food.id === selectedFoodId)
      : undefined;

    if (selectedFood) {
      calculatedItems.push(
        calculateMealItem(selectedFood, item, getFoodDisplayName(selectedFood, language)),
      );
      continue;
    }

    const match = await resolveParsedFoodItemWithFallback({
      item,
      foods,
      userId,
      language,
    });

    if (match.status === "not_found") {
      unmatchedItems.push(item);
      continue;
    }

    if (match.status === "ambiguous") {
      await setConversationState(
        userId,
        ConversationStep.FOOD_ENTRY,
        payload as unknown as ConversationPayload,
      );
      await ctx.reply(t(language, "food.ambiguous", { label: item.rawLabel }), {
        reply_markup: foodOptionsKeyboard(index, match.options, language),
      });
      return;
    }

    calculatedItems.push(
      calculateMealItem(
        match.food,
        match.parsedItem,
        getFoodDisplayName(match.food, language),
      ),
    );
  }

  if (calculatedItems.length === 0) {
    await resetConversationState(userId);
    await ctx.reply(
      t(language, "food.notFound", {
        label: formatUnmatchedLabels(unmatchedItems),
      }),
    );
    return;
  }

  const meal = calculateMeal(calculatedItems);

  if (options.requireFoodEntryClaim) {
    const claimed = await claimConversationStep(userId, ConversationStep.FOOD_ENTRY);

    if (!claimed) {
      await ctx.reply(t(language, "food.clarificationExpired"));
      return;
    }
  }

  await createMealEntry({
    userId,
    telegramUserId,
    rawText: payload.rawText,
    meal,
  });
  await resetConversationState(userId);

  const dailySummary = await getDailyNutritionSummary(userId);
  const recordedMessage = formatMealRecorded(language, meal, dailySummary);

  await ctx.reply(
    unmatchedItems.length > 0
      ? [
          recordedMessage,
          t(language, "food.partialUnmatched", {
            matched: formatMatchedLabels(meal),
            unmatched: formatUnmatchedLabels(unmatchedItems),
          }),
        ].join("\n")
      : recordedMessage,
  );
}

async function askFoodClarification(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  ambiguity: FoodAmbiguity,
  rawText: string,
): Promise<void> {
  await setConversationState(
    userId,
    ConversationStep.FOOD_ENTRY,
    {
      payloadKind: "food_ambiguity",
      rawText,
      triggerInput: ambiguity.triggerInput,
      normalizedTriggerInput: ambiguity.normalizedTriggerInput,
      ambiguityKind: ambiguity.kind,
    } as unknown as ConversationPayload,
  );

  await ctx.reply(t(language, getFoodClarificationQuestionKey(ambiguity.kind)), {
    reply_markup: foodClarificationKeyboard(ambiguity, language),
  });
}

async function askFoodPreferenceReuse(
  ctx: Context,
  language: SupportedLanguage,
  ambiguity: FoodAmbiguity,
  preference: FoodPreferenceRecord,
  choice: FoodClarificationChoice,
): Promise<void> {
  await setConversationState(
    preference.userId,
    ConversationStep.FOOD_ENTRY,
    {
      payloadKind: "food_preference_reuse",
      rawText: ambiguity.triggerInput,
      triggerInput: ambiguity.triggerInput,
      normalizedTriggerInput: ambiguity.normalizedTriggerInput,
      ambiguityKind: ambiguity.kind,
      preferenceId: preference.id,
    } as unknown as ConversationPayload,
  );

  await ctx.reply(
    t(language, "food.clarify.reuseConfirm", {
      trigger: ambiguity.normalizedTriggerInput,
      choice: getFoodClarificationChoiceLabel(choice, language),
    }),
    {
      reply_markup: foodPreferenceReuseKeyboard(language),
    },
  );
}

async function logClarifiedFoodChoice(
  ctx: Context,
  input: {
    userId: string;
    telegramUserId: bigint;
    language: SupportedLanguage;
    rawText: string;
    triggerInput: string;
    choice: FoodClarificationChoice;
    afterLog: () => Promise<void>;
  },
): Promise<void> {
  const foods = await getActiveNutritionFoods(input.userId);
  const food = foods.find((candidate) => candidate.slug === input.choice.foodSlug);

  if (!food) {
    await ctx.reply(t(input.language, "food.clarificationExpired"));
    return;
  }

  const parsedItem = buildClarifiedFoodCandidate(input.triggerInput, input.choice);
  const meal = calculateMeal([
    calculateMealItem(
      food,
      parsedItem,
      getFoodDisplayName(food, input.language),
    ),
  ]);

  await createMealEntry({
    userId: input.userId,
    telegramUserId: input.telegramUserId,
    rawText: input.rawText,
    meal,
  });
  await input.afterLog();

  const dailySummary = await getDailyNutritionSummary(input.userId);
  await ctx.reply(formatMealRecorded(input.language, meal, dailySummary));
}

function foodClarificationKeyboard(
  ambiguity: FoodAmbiguity,
  language: SupportedLanguage,
): InlineKeyboard {
  return ambiguity.choices
    .reduce(
      (keyboard, choice) =>
        keyboard
          .text(
            getFoodClarificationChoiceLabel(choice, language),
            `food:clarify:${ambiguity.kind}:${choice.id}`,
          )
          .row(),
      new InlineKeyboard(),
    )
    .text(t(language, "food.clarify.button.other"), foodClarificationOtherAction);
}

function foodPreferenceReuseKeyboard(language: SupportedLanguage): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "food.clarify.button.yes"), "food:pref:yes")
    .text(t(language, "food.clarify.button.clarify"), "food:pref:clarify");
}

function getFoodClarificationQuestionKey(
  kind: FoodAmbiguityKind,
):
  | "food.clarify.coffee.question"
  | "food.clarify.yogurt.question"
  | "food.clarify.salad.question"
  | "food.clarify.sandwich.question"
  | "food.clarify.burger.question" {
  switch (kind) {
    case "coffee":
      return "food.clarify.coffee.question";
    case "yogurt":
      return "food.clarify.yogurt.question";
    case "salad":
      return "food.clarify.salad.question";
    case "sandwich":
      return "food.clarify.sandwich.question";
    case "burger":
      return "food.clarify.burger.question";
  }
}

function foodOptionsKeyboard(
  itemIndex: number,
  options: NutritionFoodRecord[],
  language: SupportedLanguage,
): InlineKeyboard {
  return options.slice(0, 5).reduce(
    (keyboard, food) =>
      keyboard
        .text(
          getFoodDisplayName(food, language),
          `food:choose:${itemIndex}:${food.id}`,
        )
        .row(),
    new InlineKeyboard(),
  );
}

export function formatLatestMeal(
  language: SupportedLanguage,
  meal: LatestMealEntry,
): string {
  return [
    t(language, "lastMeal.title"),
    t(language, "lastMeal.summary", {
      calories: Math.round(Number(meal.totalCalories)),
      items: meal.items.length,
    }),
    ...meal.items.slice(0, 3).map((item) =>
      t(language, "lastMeal.item", {
        name: item.matchedName,
        grams: Math.round(Number(item.grams)),
      }),
    ),
  ].join("\n");
}

function lastMealKeyboard(language: SupportedLanguage, mealEntryId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "lastLog.button.edit"), `lastmeal:edit:${mealEntryId}`)
    .text(t(language, "lastLog.button.delete"), `lastmeal:delete:${mealEntryId}`)
    .row()
    .text(t(language, "lastLog.button.cancel"), lastMealCancelAction);
}

function lastMealDeleteConfirmKeyboard(
  language: SupportedLanguage,
  mealEntryId: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "lastLog.button.confirmDelete"), `lastmeal:confirm_delete:${mealEntryId}`)
    .row()
    .text(t(language, "lastLog.button.cancel"), lastMealCancelAction);
}

export function formatRecentFoods(
  language: SupportedLanguage,
  recentFoods: RecentFood[],
): string {
  return [
    t(language, "recentFoods.title"),
    ...recentFoods.map((food, index) =>
      t(language, "recentFoods.line", {
        index: index + 1,
        name: food.name,
        grams: roundForDisplay(food.grams, 0),
        calories: Math.round(food.calories),
      }),
    ),
  ].join("\n");
}

function recentFoodsKeyboard(
  language: SupportedLanguage,
  recentFoods: RecentFood[],
): InlineKeyboard {
  return recentFoods.reduce(
    (keyboard, food) =>
      keyboard
        .text(
          t(language, "recentFoods.relogButton", {
            name: food.name,
            grams: roundForDisplay(food.grams, 0),
          }),
          `food:relog:${food.id}`,
        )
        .row(),
    new InlineKeyboard(),
  );
}

function formatMealRecorded(
  language: SupportedLanguage,
  meal: CalculatedMeal,
  dailySummary: DailyNutritionSummary,
): string {
  return [
    t(language, "food.recorded"),
    t(language, "food.estimatedNote"),
    "",
    ...meal.items.flatMap((item) => [
      t(language, "food.itemLine", {
        name: item.isEstimate
          ? `${item.matchedName} (${t(language, "food.estimatedDishSuffix")})`
          : item.matchedName,
        grams: roundForDisplay(item.grams, 0),
      }),
      formatMacroLine(language, item),
      "",
    ]),
    t(language, "food.total"),
    formatMacroLine(language, meal.totals),
    "",
    formatDailyTotals(language, dailySummary),
  ].join("\n");
}

function formatMacroLine(
  language: SupportedLanguage,
  values: {
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
  },
): string {
  return t(language, "food.macroLine", {
    calories: Math.round(values.calories),
    protein: roundForDisplay(values.proteinG, 1),
    fat: roundForDisplay(values.fatG, 1),
    carbs: roundForDisplay(values.carbsG, 1),
  });
}

function getFoodDisplayName(
  food: NutritionFoodRecord,
  language: SupportedLanguage,
): string {
  return language === "ru" ? food.nameRu : food.nameEn;
}

function roundForDisplay(value: number, fractionDigits: number): string {
  return value.toFixed(fractionDigits);
}

function formatUnmatchedLabels(items: ParsedFoodItemCandidate[]): string {
  return items.map((item) => item.rawLabel).join(", ");
}

function formatMatchedLabels(meal: CalculatedMeal): string {
  return meal.items.map((item) => item.matchedName).join(", ");
}

function readFoodEntryPayload(
  payload: ConversationPayload | null,
): FoodEntryPayload | null {
  if (!payload || typeof payload.rawText !== "string") {
    return null;
  }

  if (!Array.isArray(payload.parsedItems)) {
    return null;
  }

  const selectedFoodIdsByIndex =
    typeof payload.selectedFoodIdsByIndex === "object" &&
    payload.selectedFoodIdsByIndex !== null &&
    !Array.isArray(payload.selectedFoodIdsByIndex)
      ? Object.fromEntries(
          Object.entries(payload.selectedFoodIdsByIndex).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  const parsedItems = payload.parsedItems.filter(
    (item): item is ParsedFoodItemCandidate =>
      isRecord(item) &&
      typeof item.rawLabel === "string" &&
      typeof item.normalizedLabel === "string" &&
      typeof item.quantity === "number" &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      typeof item.unit === "string" &&
      ["g", "piece", "serving"].includes(item.unit) &&
      typeof item.grams === "number" &&
      Number.isFinite(item.grams) &&
      item.grams > 0,
  );

  if (parsedItems.length !== payload.parsedItems.length) {
    return null;
  }

  return {
    rawText: payload.rawText,
    parsedItems,
    selectedFoodIdsByIndex,
  };
}

function readFoodAmbiguityPayload(
  payload: ConversationPayload | null,
): FoodAmbiguityPayload | null {
  if (!payload || payload.payloadKind !== "food_ambiguity") {
    return null;
  }

  if (
    typeof payload.rawText !== "string" ||
    typeof payload.triggerInput !== "string" ||
    typeof payload.normalizedTriggerInput !== "string" ||
    !isFoodAmbiguityKind(payload.ambiguityKind)
  ) {
    return null;
  }

  return {
    payloadKind: "food_ambiguity",
    rawText: payload.rawText,
    triggerInput: payload.triggerInput,
    normalizedTriggerInput: payload.normalizedTriggerInput,
    ambiguityKind: payload.ambiguityKind,
  };
}

function readFoodPreferenceReusePayload(
  payload: ConversationPayload | null,
): FoodPreferenceReusePayload | null {
  if (!payload || payload.payloadKind !== "food_preference_reuse") {
    return null;
  }

  if (
    typeof payload.rawText !== "string" ||
    typeof payload.triggerInput !== "string" ||
    typeof payload.normalizedTriggerInput !== "string" ||
    typeof payload.preferenceId !== "string" ||
    !isFoodAmbiguityKind(payload.ambiguityKind)
  ) {
    return null;
  }

  return {
    payloadKind: "food_preference_reuse",
    rawText: payload.rawText,
    triggerInput: payload.triggerInput,
    normalizedTriggerInput: payload.normalizedTriggerInput,
    ambiguityKind: payload.ambiguityKind,
    preferenceId: payload.preferenceId,
  };
}

function isFoodAmbiguityKind(value: unknown): value is FoodAmbiguityKind {
  return (
    value === "coffee" ||
    value === "yogurt" ||
    value === "salad" ||
    value === "sandwich" ||
    value === "burger"
  );
}

function readLatestMealPayload(
  payload: ConversationPayload | null,
): { mealEntryId: string } | null {
  if (!payload || typeof payload.mealEntryId !== "string") {
    return null;
  }

  return {
    mealEntryId: payload.mealEntryId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getFoodIdentity(ctx: Context): Promise<{
  userId: string;
  language: SupportedLanguage;
} | null> {
  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return null;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );

  return {
    userId: user.id,
    language,
  };
}

function getCommandArgument(ctx: Context): string | null {
  const match = ctx.match;

  if (typeof match !== "string") {
    return null;
  }

  const trimmedMatch = match.trim();
  return trimmedMatch.length > 0 ? trimmedMatch : null;
}
