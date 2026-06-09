import type { Context } from "grammy";

import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { formatHelpText } from "./help.js";
import { mainMenuKeyboard, menuAction } from "./keyboards.js";
import { startCheckinFlow } from "./progress.js";

export function mainMenuText(language: SupportedLanguage): string {
  return [
    t(language, "menu.title"),
    "",
    t(language, "menu.description"),
  ].join("\n");
}

const textKeyByAction: Partial<Record<string, Parameters<typeof t>[1]>> = {
  [menuAction.nutrition]: "menu.section.nutrition",
  [menuAction.workout]: "menu.section.workout",
  [menuAction.progress]: "menu.section.progress",
};

export async function replyWithMainMenu(
  ctx: Context,
  language: SupportedLanguage,
): Promise<void> {
  await ctx.reply(mainMenuText(language), {
    reply_markup: mainMenuKeyboard(language),
  });
}

export async function handleMainMenuAction(ctx: Context): Promise<void> {
  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(profile?.preferredLanguage);
  const callbackData = ctx.callbackQuery?.data;
  const key = callbackData ? textKeyByAction[callbackData] : undefined;

  await ctx.answerCallbackQuery();

  if (callbackData === menuAction.help) {
    await ctx.reply(formatHelpText(language), {
      reply_markup: mainMenuKeyboard(language),
    });
    return;
  }

  if (callbackData === menuAction.checkin) {
    await startCheckinFlow(ctx);
    return;
  }

  if (!key) {
    await ctx.reply(t(language, "common.unknownAction"));
    return;
  }

  await ctx.reply(t(language, key), {
    reply_markup: mainMenuKeyboard(language),
  });
}
