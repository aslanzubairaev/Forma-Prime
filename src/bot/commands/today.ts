import type { Bot } from "grammy";

import { normalizeLanguage, t } from "../../i18n/index.js";
import { getDailyNutritionSummary } from "../../meals/meals.service.js";
import { getProfileByUserId } from "../../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../../users/user.service.js";
import { formatDailyTotals } from "../food-logging.js";

export function registerTodayCommand(bot: Bot): void {
  bot.command("today", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply(t("en", "common.missingTelegramUser"));
      return;
    }

    const user = await upsertTelegramUser(ctx.from);
    const profile = await getProfileByUserId(user.id);
    const language = normalizeLanguage(
      profile?.preferredLanguage ?? user.languageCode,
    );
    const dailySummary = await getDailyNutritionSummary(user.id);

    await ctx.reply(formatDailyTotals(language, dailySummary));
  });
}
