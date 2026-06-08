import { ConversationStep } from "@prisma/client";
import { InlineKeyboard, type Bot, type Context } from "grammy";

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
  getDailyNutritionSummary,
  type DailyNutritionSummary,
} from "../meals/meals.service.js";
import { parseFoodDraft } from "../meals/ai-food-draft.service.js";
import type { CalculatedMeal, NutritionFoodRecord, ParsedFoodItemCandidate } from "../nutrition/food.types.js";
import { matchFoodCandidate } from "../nutrition/food-matcher.js";
import { parseFoodLogMessage } from "../nutrition/food-parser.js";
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

const foodChoicePattern = /^food:choose:(\d+):(.+)$/;

export function registerFoodLoggingHandlers(bot: Bot): void {
  bot.callbackQuery(foodChoicePattern, handleFoodChoiceCallback);
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

async function handleFoodText(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    return;
  }

  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );

  if (!profile?.onboardingCompletedAt) {
    await beginOrResumeOnboarding(ctx, user.id, language);
    return;
  }

  await processFoodLog(ctx, user.id, BigInt(ctx.from.id), rawText, language);
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

async function processFoodLog(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  rawText: string,
  language: SupportedLanguage,
): Promise<void> {
  const parsed = parseFoodLogMessage(rawText);

  if (parsed.items.length > 0 && parsed.rejectedParts.length === 0) {
    await continueFoodLogWithSelection(ctx, userId, telegramUserId, language, {
      rawText,
      parsedItems: parsed.items,
      selectedFoodIdsByIndex: {},
    });
    return;
  }

  const draft = await parseFoodDraft(rawText, language);

  if (draft.status !== "ok") {
    await ctx.reply(t(language, "food.parseFailed"));
    return;
  }

  await continueFoodLogWithSelection(ctx, userId, telegramUserId, language, {
    rawText,
    parsedItems: draft.items,
    selectedFoodIdsByIndex: {},
  });
}

async function continueFoodLogWithSelection(
  ctx: Context,
  userId: string,
  telegramUserId: bigint,
  language: SupportedLanguage,
  payload: FoodEntryPayload,
  options: { requireFoodEntryClaim?: boolean } = {},
): Promise<void> {
  const foods = await getActiveNutritionFoods();
  const calculatedItems = [];

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

    const match = matchFoodCandidate(item, foods);

    if (match.status === "not_found") {
      await resetConversationState(userId);
      await ctx.reply(t(language, "food.notFound", { label: item.rawLabel }));
      return;
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
        item,
        getFoodDisplayName(match.food, language),
      ),
    );
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
  await ctx.reply(formatMealRecorded(language, meal, dailySummary));
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
        name: item.matchedName,
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
      item.unit === "g" &&
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
