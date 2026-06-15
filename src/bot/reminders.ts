import type {
  ConversationStep as ConversationStepType,
  ReminderType as ReminderTypeType,
} from "@prisma/client";
import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";

import {
  getConversationState,
  resetConversationState,
  setConversationState,
} from "../conversation/conversation-state.service.js";
import type { ConversationPayload } from "../conversation/conversation-state.types.js";
import {
  ConversationStep,
  ReminderType,
} from "../db/prisma-client.js";
import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import {
  allWeekdays,
  disableReminderPreference,
  getReminderPreferences,
  parseReminderTime,
  upsertReminderPreference,
} from "../reminders/reminder.service.js";
import type { ReminderSetupPayload } from "../reminders/reminder.types.js";
import { upsertTelegramUser } from "../users/user.service.js";

const reminderStartAction = "reminder:start";
const reminderTypePattern =
  /^reminder:type:(FOOD_LOG|WORKOUT_LOG|WEEKLY_CHECKIN)$/;
const reminderActionPattern = /^reminder:action:(enable|disable)$/;
const reminderWeekdayPattern = /^reminder:weekday:([0-6])$/;

const reminderTypes = [
  ReminderType.FOOD_LOG,
  ReminderType.WORKOUT_LOG,
  ReminderType.WEEKLY_CHECKIN,
];

const reminderSteps = new Set<ConversationStepType>([
  ConversationStep.REMINDER_TYPE,
  ConversationStep.REMINDER_ACTION,
  ConversationStep.REMINDER_WEEKDAY,
  ConversationStep.REMINDER_TIME,
]);

export function registerReminderHandlers(bot: Bot): void {
  bot.command("reminders", handleRemindersCommand);
  bot.command("remindme", startReminderSettingsFlow);
  bot.callbackQuery(reminderStartAction, handleReminderStartCallback);
  bot.callbackQuery(reminderTypePattern, handleReminderTypeCallback);
  bot.callbackQuery(reminderActionPattern, handleReminderActionCallback);
  bot.callbackQuery(reminderWeekdayPattern, handleReminderWeekdayCallback);
  bot.on("message:text", handleReminderText);
}

async function handleRemindersCommand(ctx: Context): Promise<void> {
  const identity = await getReminderIdentity(ctx);

  if (!identity) {
    return;
  }

  const preferences = await getReminderPreferences(identity.userId);

  await ctx.reply(formatReminderPreferences(identity.language, preferences), {
    reply_markup: new InlineKeyboard().text(
      t(identity.language, "reminders.configure"),
      reminderStartAction,
    ),
  });
}

async function startReminderSettingsFlow(ctx: Context): Promise<void> {
  const identity = await getReminderIdentity(ctx);

  if (!identity) {
    return;
  }

  await startReminderTypeSelection(ctx, identity.userId, identity.language);
}

async function handleReminderStartCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getReminderIdentity(ctx);

  if (!identity) {
    return;
  }

  await startReminderTypeSelection(ctx, identity.userId, identity.language);
}

async function handleReminderTypeCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getReminderIdentity(ctx);
  const match = ctx.callbackQuery?.data?.match(reminderTypePattern);

  if (!identity || !match?.[1]) {
    return;
  }

  const state = await getConversationState(identity.userId);

  if (state.step !== ConversationStep.REMINDER_TYPE) {
    await ctx.reply(t(identity.language, "reminders.expired"));
    return;
  }

  const type = readReminderType(match[1]);

  if (!type) {
    await ctx.reply(t(identity.language, "reminders.expired"));
    return;
  }

  await setConversationState(identity.userId, ConversationStep.REMINDER_ACTION, {
    type,
  });
  await ctx.reply(
    t(identity.language, "reminders.chooseAction", {
      type: getReminderTypeLabel(identity.language, type),
    }),
    {
      reply_markup: reminderActionKeyboard(identity.language),
    },
  );
}

async function handleReminderActionCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getReminderIdentity(ctx);
  const match = ctx.callbackQuery?.data?.match(reminderActionPattern);

  if (!identity || !match?.[1]) {
    return;
  }

  const state = await getConversationState(identity.userId);
  const payload = readReminderSetupPayload(state.payload);

  if (state.step !== ConversationStep.REMINDER_ACTION || !payload.type) {
    await ctx.reply(t(identity.language, "reminders.expired"));
    return;
  }

  if (match[1] === "disable") {
    await disableReminderPreference({
      userId: identity.userId,
      type: payload.type,
    });
    await resetConversationState(identity.userId);
    await ctx.reply(t(identity.language, "reminders.disabledSaved"));
    return;
  }

  if (payload.type === ReminderType.WEEKLY_CHECKIN) {
    await setConversationState(identity.userId, ConversationStep.REMINDER_WEEKDAY, {
      type: payload.type,
      isEnabled: true,
    });
    await ctx.reply(t(identity.language, "reminders.askWeekday"), {
      reply_markup: weekdayKeyboard(identity.language),
    });
    return;
  }

  await setConversationState(identity.userId, ConversationStep.REMINDER_TIME, {
    type: payload.type,
    isEnabled: true,
  });
  await ctx.reply(t(identity.language, "reminders.askTime"));
}

async function handleReminderWeekdayCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getReminderIdentity(ctx);
  const match = ctx.callbackQuery?.data?.match(reminderWeekdayPattern);

  if (!identity || !match?.[1]) {
    return;
  }

  const state = await getConversationState(identity.userId);
  const payload = readReminderSetupPayload(state.payload);
  const weekday = Number(match[1]);

  if (
    state.step !== ConversationStep.REMINDER_WEEKDAY ||
    payload.type !== ReminderType.WEEKLY_CHECKIN
  ) {
    await ctx.reply(t(identity.language, "reminders.expired"));
    return;
  }

  await setConversationState(identity.userId, ConversationStep.REMINDER_TIME, {
    type: payload.type,
    isEnabled: true,
    weekday,
  });
  await ctx.reply(t(identity.language, "reminders.askTime"));
}

async function handleReminderText(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    await next();
    return;
  }

  const identity = await getReminderIdentity(ctx);

  if (!identity) {
    return;
  }

  const state = await getConversationState(identity.userId);

  if (!reminderSteps.has(state.step)) {
    await next();
    return;
  }

  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    await next();
    return;
  }

  if (state.step !== ConversationStep.REMINDER_TIME) {
    await ctx.reply(t(identity.language, "common.useCurrentQuestion"));
    return;
  }

  await saveReminderTimeInput(
    ctx,
    identity.userId,
    identity.language,
    readReminderSetupPayload(state.payload),
    rawText,
  );
}

export async function saveReminderTimeInput(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  payload: ReminderSetupPayload,
  rawTime: string,
  options: {
    upsertPreference?: typeof upsertReminderPreference;
    resetState?: typeof resetConversationState;
  } = {},
): Promise<void> {
  if (!payload.type || payload.isEnabled !== true) {
    await resetConversationState(userId);
    await ctx.reply(t(language, "reminders.expired"));
    return;
  }

  if (
    payload.type === ReminderType.WEEKLY_CHECKIN &&
    payload.weekday === undefined
  ) {
    await resetConversationState(userId);
    await ctx.reply(t(language, "reminders.expired"));
    return;
  }

  const parsedTime = parseReminderTime(rawTime);

  if (parsedTime.status === "invalid") {
    await ctx.reply(t(language, "reminders.invalidTime"));
    await ctx.reply(t(language, "reminders.askTime"));
    return;
  }

  const upsertPreference = options.upsertPreference ?? upsertReminderPreference;
  const resetState = options.resetState ?? resetConversationState;
  const preferenceInput: Parameters<typeof upsertPreference>[0] = {
    userId,
    type: payload.type,
    isEnabled: true,
    hour: parsedTime.hour,
    minute: parsedTime.minute,
  };

  if (payload.weekday !== undefined) {
    preferenceInput.weekday = payload.weekday;
  }

  await upsertPreference(preferenceInput);
  await resetState(userId);
  await ctx.reply(t(language, "reminders.saved"));
}

async function startReminderTypeSelection(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
): Promise<void> {
  await setConversationState(userId, ConversationStep.REMINDER_TYPE, {});
  await ctx.reply(t(language, "reminders.chooseType"), {
    reply_markup: reminderTypeKeyboard(language),
  });
}

function formatReminderPreferences(
  language: SupportedLanguage,
  preferences: Array<{
    type: ReminderTypeType;
    isEnabled: boolean;
    hourLocal: number;
    minuteLocal: number;
    daysOfWeek: number[];
  }>,
): string {
  const lines = reminderTypes.map((type) => {
    const preference = preferences.find((item) => item.type === type);

    if (!preference) {
      return t(language, "reminders.line", {
        type: getReminderTypeLabel(language, type),
        status: t(language, "reminders.notConfigured"),
        time: "-",
        days: "-",
      });
    }

    return t(language, "reminders.line", {
      type: getReminderTypeLabel(language, type),
      status: t(
        language,
        preference.isEnabled ? "reminders.enabled" : "reminders.disabled",
      ),
      time: formatReminderTime(preference.hourLocal, preference.minuteLocal),
      days: formatReminderDays(language, type, preference.daysOfWeek),
    });
  });

  return [t(language, "reminders.title"), ...lines].join("\n");
}

function reminderTypeKeyboard(language: SupportedLanguage): InlineKeyboard {
  return reminderTypes.reduce(
    (keyboard, type) =>
      keyboard
        .text(getReminderTypeLabel(language, type), `reminder:type:${type}`)
        .row(),
    new InlineKeyboard(),
  );
}

function reminderActionKeyboard(language: SupportedLanguage): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "reminders.button.enable"), "reminder:action:enable")
    .text(t(language, "reminders.button.disable"), "reminder:action:disable");
}

function weekdayKeyboard(language: SupportedLanguage): InlineKeyboard {
  return allWeekdays.reduce(
    (keyboard, weekday) =>
      keyboard
        .text(t(language, weekdayLabelKey(weekday)), `reminder:weekday:${weekday}`)
        .row(),
    new InlineKeyboard(),
  );
}

function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatReminderDays(
  language: SupportedLanguage,
  type: ReminderTypeType,
  daysOfWeek: number[],
): string {
  if (type !== ReminderType.WEEKLY_CHECKIN) {
    return t(language, "reminders.everyDay");
  }

  const weekday = daysOfWeek[0];

  if (weekday === undefined) {
    return "-";
  }

  return t(language, weekdayLabelKey(weekday));
}

function getReminderTypeLabel(
  language: SupportedLanguage,
  type: ReminderTypeType,
): string {
  return t(language, reminderTypeLabelKey[type]);
}

function readReminderSetupPayload(
  payload: ConversationPayload | null,
): ReminderSetupPayload {
  const source = payload ?? {};
  const result: ReminderSetupPayload = {};
  const type = typeof source.type === "string" ? readReminderType(source.type) : null;

  if (type) {
    result.type = type;
  }

  if (typeof source.isEnabled === "boolean") {
    result.isEnabled = source.isEnabled;
  }

  if (
    typeof source.weekday === "number" &&
    Number.isInteger(source.weekday) &&
    source.weekday >= 0 &&
    source.weekday <= 6
  ) {
    result.weekday = source.weekday;
  }

  return result;
}

function readReminderType(value: string): ReminderTypeType | null {
  if (
    value === ReminderType.FOOD_LOG ||
    value === ReminderType.WORKOUT_LOG ||
    value === ReminderType.WEEKLY_CHECKIN
  ) {
    return value;
  }

  return null;
}

async function getReminderIdentity(ctx: Context): Promise<{
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

const reminderTypeLabelKey: Record<ReminderTypeType, Parameters<typeof t>[1]> = {
  [ReminderType.FOOD_LOG]: "reminders.type.food",
  [ReminderType.WORKOUT_LOG]: "reminders.type.workout",
  [ReminderType.WEEKLY_CHECKIN]: "reminders.type.weeklyCheckin",
};

function weekdayLabelKey(weekday: number): Parameters<typeof t>[1] {
  if (weekday === 0) {
    return "reminders.weekday.0";
  }

  if (weekday === 1) {
    return "reminders.weekday.1";
  }

  if (weekday === 2) {
    return "reminders.weekday.2";
  }

  if (weekday === 3) {
    return "reminders.weekday.3";
  }

  if (weekday === 4) {
    return "reminders.weekday.4";
  }

  if (weekday === 5) {
    return "reminders.weekday.5";
  }

  return "reminders.weekday.6";
}
