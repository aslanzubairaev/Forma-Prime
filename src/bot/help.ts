import type { Bot, Context } from "grammy";

import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { mainMenuKeyboard } from "./keyboards.js";

export function registerHelpCommand(bot: Bot): void {
  bot.command("help", handleHelpCommand);
}

export function formatHelpText(language: SupportedLanguage): string {
  return [
    t(language, "help.title"),
    "",
    t(language, "help.onboarding"),
    t(language, "help.food"),
    t(language, "help.workout"),
    t(language, "help.progress"),
    t(language, "help.customFoods"),
    t(language, "help.latestLogs"),
    t(language, "help.reminders"),
    "",
    t(language, "help.menuHint"),
  ].join("\n");
}

async function handleHelpCommand(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );

  await ctx.reply(formatHelpText(language), {
    reply_markup: mainMenuKeyboard(language),
  });
}
