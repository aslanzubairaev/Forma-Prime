import type { Bot } from "grammy";

import { normalizeLanguage, t } from "../i18n/index.js";
import {
  type DueReminderPreference,
  getDueReminderPreferences,
  getReminderDeliveryTextKey,
  markReminderSent,
} from "./reminder.service.js";

export async function runReminderDelivery(input: {
  bot: Bot;
  referenceDate?: Date;
  getDuePreferences?: typeof getDueReminderPreferences;
  markSent?: typeof markReminderSent;
}): Promise<{ sentCount: number }> {
  const referenceDate = input.referenceDate ?? new Date();
  const getDuePreferences = input.getDuePreferences ?? getDueReminderPreferences;
  const markSent = input.markSent ?? markReminderSent;
  const duePreferences: DueReminderPreference[] =
    await getDuePreferences(referenceDate);
  let sentCount = 0;

  for (const preference of duePreferences) {
    const language = normalizeLanguage(
      preference.user.profile?.preferredLanguage ?? preference.user.languageCode,
    );

    await input.bot.api.sendMessage(
      preference.user.telegramId.toString(),
      t(language, getReminderDeliveryTextKey(preference.type)),
    );
    await markSent(preference.id, referenceDate);
    sentCount += 1;
  }

  return {
    sentCount,
  };
}
