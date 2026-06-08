import type { Bot } from "grammy";

import { normalizeLanguage, t } from "../i18n/index.js";
import {
  getDueReminderPreferences,
  getReminderDeliveryTextKey,
  markReminderSent,
} from "./reminder.service.js";

export async function runReminderDelivery(input: {
  bot: Bot;
  referenceDate?: Date;
}): Promise<{ sentCount: number }> {
  const referenceDate = input.referenceDate ?? new Date();
  const duePreferences = await getDueReminderPreferences(referenceDate);
  let sentCount = 0;

  for (const preference of duePreferences) {
    const language = normalizeLanguage(
      preference.user.profile?.preferredLanguage ?? preference.user.languageCode,
    );

    await input.bot.api.sendMessage(
      preference.user.telegramId.toString(),
      t(language, getReminderDeliveryTextKey(preference.type)),
    );
    await markReminderSent(preference.id, referenceDate);
    sentCount += 1;
  }

  return {
    sentCount,
  };
}
