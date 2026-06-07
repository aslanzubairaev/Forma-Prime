import type { Bot } from "grammy";

import { normalizeLanguage, t } from "../../i18n/index.js";
import { getMealsToday } from "../../meals/meals.service.js";
import { getProfileByUserId } from "../../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../../users/user.service.js";

export function registerMealsCommand(bot: Bot): void {
  bot.command("meals", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply(t("en", "common.missingTelegramUser"));
      return;
    }

    const user = await upsertTelegramUser(ctx.from);
    const profile = await getProfileByUserId(user.id);
    const language = normalizeLanguage(
      profile?.preferredLanguage ?? user.languageCode,
    );
    const meals = await getMealsToday(user.id);

    if (meals.length === 0) {
      await ctx.reply(t(language, "meals.empty"));
      return;
    }

    await ctx.reply(
      [
        t(language, "meals.title"),
        ...meals.map((meal) =>
          t(language, "meals.line", {
            calories: Math.round(Number(meal.totalCalories)),
            items: meal.items.length,
          }),
        ),
      ].join("\n"),
    );
  });
}
