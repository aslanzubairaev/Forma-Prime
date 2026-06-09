import type { Bot, Context } from "grammy";

import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";

export function registerFallbackHandlers(bot: Bot): void {
  bot.on("message:text", handleTextFallback);
}

export function formatTextFallback(language: SupportedLanguage): string {
  return t(language, "common.textFallback");
}

async function handleTextFallback(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );

  await ctx.reply(formatTextFallback(language));
}
