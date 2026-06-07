import type { Bot } from "grammy";

import { normalizeLanguage, t } from "../../i18n/index.js";
import { getProfileByUserId } from "../../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../../users/user.service.js";

export function registerFoodCommand(bot: Bot): void {
  bot.command("food", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply(t("en", "common.missingTelegramUser"));
      return;
    }

    const user = await upsertTelegramUser(ctx.from);
    const profile = await getProfileByUserId(user.id);
    const language = normalizeLanguage(
      profile?.preferredLanguage ?? user.languageCode,
    );

    await ctx.reply(t(language, "food.command.help"));
  });
}
