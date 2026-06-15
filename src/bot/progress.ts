import type { ConversationStep as ConversationStepType } from "@prisma/client";
import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";

import {
  claimConversationStep,
  getConversationState,
  resetConversationState,
  setConversationState,
} from "../conversation/conversation-state.service.js";
import type { ConversationPayload } from "../conversation/conversation-state.types.js";
import { ConversationStep } from "../db/prisma-client.js";
import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import {
  buildWeeklyCheckinSummary,
  completeWeeklyCheckin,
  formatProgressSummary,
  formatWeeklySummary,
  formatWeight,
  getProgressSummary,
  getWeeklySummary,
  logBodyweight,
  parseRating,
  parseWeightKg,
} from "../progress/progress.service.js";
import type { WeeklyCheckinPayload } from "../progress/progress.types.js";
import { upsertTelegramUser } from "../users/user.service.js";

const checkinRatingPattern = /^checkin:(nutrition|training|energy):([1-5])$/;
const checkinSkipNotesAction = "checkin:notes:skip";

const progressSteps = new Set<ConversationStepType>([
  ConversationStep.WEIGHT_ENTRY,
  ConversationStep.CHECKIN_WEIGHT,
  ConversationStep.CHECKIN_NUTRITION,
  ConversationStep.CHECKIN_TRAINING,
  ConversationStep.CHECKIN_ENERGY,
  ConversationStep.CHECKIN_NOTES,
]);

export function registerProgressHandlers(bot: Bot): void {
  bot.command("weight", handleWeightCommand);
  bot.command("progress", handleProgressCommand);
  bot.command("summary", handleWeeklySummaryCommand);
  bot.command("week", handleWeeklySummaryCommand);
  bot.command("checkin", startCheckinFlow);
  bot.callbackQuery(checkinRatingPattern, handleCheckinRatingCallback);
  bot.callbackQuery(checkinSkipNotesAction, handleSkipNotesCallback);
  bot.on("message:text", handleProgressText);
}

export async function startCheckinFlow(ctx: Context): Promise<void> {
  const identity = await getProgressIdentity(ctx);

  if (!identity) {
    return;
  }

  await setConversationState(identity.userId, ConversationStep.CHECKIN_WEIGHT, {});
  await ctx.reply(t(identity.language, "checkin.start"));
  await ctx.reply(t(identity.language, "checkin.askWeight"));
}

async function handleWeightCommand(ctx: Context): Promise<void> {
  const identity = await getProgressIdentity(ctx);

  if (!identity) {
    return;
  }

  const rawWeight = getCommandArgument(ctx);

  if (!rawWeight) {
    await setConversationState(identity.userId, ConversationStep.WEIGHT_ENTRY, {});
    await ctx.reply(t(identity.language, "weight.prompt"));
    return;
  }

  await saveManualWeight(ctx, identity.userId, identity.language, rawWeight);
}

async function handleProgressCommand(ctx: Context): Promise<void> {
  const identity = await getProgressIdentity(ctx);

  if (!identity) {
    return;
  }

  await ctx.reply(
    formatProgressSummary(
      identity.language,
      await getProgressSummary(identity.userId),
    ),
  );
}

async function handleWeeklySummaryCommand(ctx: Context): Promise<void> {
  const identity = await getProgressIdentity(ctx);

  if (!identity) {
    return;
  }

  await ctx.reply(
    formatWeeklySummary(
      identity.language,
      await getWeeklySummary(identity.userId),
    ),
  );
}

async function handleProgressText(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    await next();
    return;
  }

  const identity = await getProgressIdentity(ctx);

  if (!identity) {
    return;
  }

  const state = await getConversationState(identity.userId);

  if (!progressSteps.has(state.step)) {
    await next();
    return;
  }

  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    await next();
    return;
  }

  if (state.step === ConversationStep.WEIGHT_ENTRY) {
    await saveManualWeight(ctx, identity.userId, identity.language, rawText, {
      repeatPromptOnInvalid: true,
      requireStepClaim: ConversationStep.WEIGHT_ENTRY,
    });
    return;
  }

  if (state.step === ConversationStep.CHECKIN_WEIGHT) {
    const parsedWeight = parseWeightKg(rawText);

    if (parsedWeight.status === "invalid") {
      await ctx.reply(t(identity.language, "weight.invalid"));
      await ctx.reply(t(identity.language, "checkin.askWeight"));
      return;
    }

    if (parsedWeight.status === "out_of_range") {
      await ctx.reply(t(identity.language, "weight.outOfRange"));
      await ctx.reply(t(identity.language, "checkin.askWeight"));
      return;
    }

    await setConversationState(identity.userId, ConversationStep.CHECKIN_NUTRITION, {
      weightKg: parsedWeight.value,
    });
    await askCheckinRating(ctx, identity.language, "checkin.askNutrition", "nutrition");
    return;
  }

  if (
    state.step === ConversationStep.CHECKIN_NUTRITION ||
    state.step === ConversationStep.CHECKIN_TRAINING ||
    state.step === ConversationStep.CHECKIN_ENERGY
  ) {
    const rating = parseRating(rawText);

    if (rating === null) {
      await ctx.reply(t(identity.language, "checkin.ratingInvalid"));
      await askForCurrentCheckinStep(ctx, state.step, identity.language);
      return;
    }

    await applyCheckinRating(
      ctx,
      identity.userId,
      identity.language,
      state.step,
      readCheckinPayload(state.payload),
      rating,
    );
    return;
  }

  if (state.step === ConversationStep.CHECKIN_NOTES) {
    const note = rawText.length === 0 ? null : rawText;
    await finishCheckin(
      ctx,
      identity.userId,
      identity.language,
      readCheckinPayload(state.payload),
      note,
    );
  }
}

async function handleCheckinRatingCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getProgressIdentity(ctx);
  const match = ctx.callbackQuery?.data?.match(checkinRatingPattern);

  if (!identity || !match?.[1] || !match[2]) {
    return;
  }

  const state = await getConversationState(identity.userId);
  const expectedStep = expectedRatingStep(match[1]);
  const payload = readCheckinPayload(state.payload);

  if (!expectedStep || state.step !== expectedStep) {
    await ctx.reply(t(identity.language, "checkin.expired"));
    return;
  }

  const claimed = await claimConversationStep(identity.userId, state.step);

  if (!claimed) {
    await ctx.reply(t(identity.language, "checkin.expired"));
    return;
  }

  await applyCheckinRating(
    ctx,
    identity.userId,
    identity.language,
    state.step,
    payload,
    Number(match[2]),
  );
}

async function handleSkipNotesCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getProgressIdentity(ctx);

  if (!identity) {
    return;
  }

  const state = await getConversationState(identity.userId);

  if (state.step !== ConversationStep.CHECKIN_NOTES) {
    await ctx.reply(t(identity.language, "checkin.expired"));
    return;
  }

  await finishCheckin(
    ctx,
    identity.userId,
    identity.language,
    readCheckinPayload(state.payload),
    null,
  );
}

export async function saveManualWeight(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  rawWeight: string,
  options: {
    repeatPromptOnInvalid?: boolean;
    requireStepClaim?: ConversationStepType;
    claimStep?: typeof claimConversationStep;
    logWeight?: typeof logBodyweight;
    resetState?: typeof resetConversationState;
  } = {},
): Promise<void> {
  const parsedWeight = parseWeightKg(rawWeight);

  if (parsedWeight.status === "invalid") {
    await ctx.reply(t(language, "weight.invalid"));
    if (options.repeatPromptOnInvalid) {
      await ctx.reply(t(language, "weight.prompt"));
    }
    return;
  }

  if (parsedWeight.status === "out_of_range") {
    await ctx.reply(t(language, "weight.outOfRange"));
    if (options.repeatPromptOnInvalid) {
      await ctx.reply(t(language, "weight.prompt"));
    }
    return;
  }

  if (options.requireStepClaim) {
    const claimStep = options.claimStep ?? claimConversationStep;
    const claimed = await claimStep(userId, options.requireStepClaim);

    if (!claimed) {
      await ctx.reply(t(language, "weight.expired"));
      return;
    }
  }

  const logWeight = options.logWeight ?? logBodyweight;
  const resetState = options.resetState ?? resetConversationState;

  await logWeight({
    userId,
    weightKg: parsedWeight.value,
  });
  await resetState(userId);
  await ctx.reply(t(language, "weight.saved", {
    weight: formatWeight(parsedWeight.value),
  }));
}

async function applyCheckinRating(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  step: ConversationStepType,
  payload: WeeklyCheckinPayload,
  rating: number,
): Promise<void> {
  if (step === ConversationStep.CHECKIN_NUTRITION) {
    const nextPayload = { ...payload, nutritionAdherence: rating };
    await setConversationState(userId, ConversationStep.CHECKIN_TRAINING, nextPayload);
    await askCheckinRating(ctx, language, "checkin.askTraining", "training");
    return;
  }

  if (step === ConversationStep.CHECKIN_TRAINING) {
    const nextPayload = { ...payload, trainingAdherence: rating };
    await setConversationState(userId, ConversationStep.CHECKIN_ENERGY, nextPayload);
    await askCheckinRating(ctx, language, "checkin.askEnergy", "energy");
    return;
  }

  if (step === ConversationStep.CHECKIN_ENERGY) {
    const nextPayload = { ...payload, energy: rating };
    await setConversationState(userId, ConversationStep.CHECKIN_NOTES, nextPayload);
    await ctx.reply(t(language, "checkin.askNotes"), {
      reply_markup: new InlineKeyboard().text(
        t(language, "checkin.skipNotes"),
        checkinSkipNotesAction,
      ),
    });
  }
}

export async function finishCheckin(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  payload: WeeklyCheckinPayload,
  notes: string | null,
  options: {
    claimStep?: typeof claimConversationStep;
    completeCheckin?: typeof completeWeeklyCheckin;
    resetState?: typeof resetConversationState;
  } = {},
): Promise<void> {
  if (
    payload.weightKg === undefined ||
    payload.nutritionAdherence === undefined ||
    payload.trainingAdherence === undefined ||
    payload.energy === undefined
  ) {
    await resetConversationState(userId);
    await ctx.reply(t(language, "checkin.expired"));
    return;
  }

  const claimStep = options.claimStep ?? claimConversationStep;
  const claimed = await claimStep(userId, ConversationStep.CHECKIN_NOTES);

  if (!claimed) {
    await ctx.reply(t(language, "checkin.expired"));
    return;
  }

  const completeCheckin = options.completeCheckin ?? completeWeeklyCheckin;
  const resetState = options.resetState ?? resetConversationState;
  const summary = await completeCheckin({
    userId,
    weightKg: payload.weightKg,
    nutritionAdherence: payload.nutritionAdherence,
    trainingAdherence: payload.trainingAdherence,
    energy: payload.energy,
    notes,
  });

  await resetState(userId);
  await ctx.reply(buildWeeklyCheckinSummary(language, summary));
}

async function askForCurrentCheckinStep(
  ctx: Context,
  step: ConversationStepType,
  language: SupportedLanguage,
): Promise<void> {
  if (step === ConversationStep.CHECKIN_NUTRITION) {
    await askCheckinRating(ctx, language, "checkin.askNutrition", "nutrition");
    return;
  }

  if (step === ConversationStep.CHECKIN_TRAINING) {
    await askCheckinRating(ctx, language, "checkin.askTraining", "training");
    return;
  }

  if (step === ConversationStep.CHECKIN_ENERGY) {
    await askCheckinRating(ctx, language, "checkin.askEnergy", "energy");
  }
}

async function askCheckinRating(
  ctx: Context,
  language: SupportedLanguage,
  questionKey: Parameters<typeof t>[1],
  field: "nutrition" | "training" | "energy",
): Promise<void> {
  await ctx.reply(t(language, questionKey), {
    reply_markup: ratingKeyboard(field),
  });
}

function ratingKeyboard(field: "nutrition" | "training" | "energy"): InlineKeyboard {
  return [1, 2, 3, 4, 5].reduce(
    (keyboard, rating) =>
      keyboard.text(String(rating), `checkin:${field}:${rating}`),
    new InlineKeyboard(),
  );
}

function expectedRatingStep(field: string): ConversationStepType | null {
  if (field === "nutrition") {
    return ConversationStep.CHECKIN_NUTRITION;
  }

  if (field === "training") {
    return ConversationStep.CHECKIN_TRAINING;
  }

  if (field === "energy") {
    return ConversationStep.CHECKIN_ENERGY;
  }

  return null;
}

function readCheckinPayload(
  payload: ConversationPayload | null,
): WeeklyCheckinPayload {
  const source = payload ?? {};
  const result: WeeklyCheckinPayload = {};

  if (typeof source.weightKg === "number") {
    result.weightKg = source.weightKg;
  }

  if (typeof source.nutritionAdherence === "number") {
    result.nutritionAdherence = source.nutritionAdherence;
  }

  if (typeof source.trainingAdherence === "number") {
    result.trainingAdherence = source.trainingAdherence;
  }

  if (typeof source.energy === "number") {
    result.energy = source.energy;
  }

  return result;
}

async function getProgressIdentity(ctx: Context): Promise<{
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
