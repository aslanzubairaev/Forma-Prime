import type { Context } from "grammy";

import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { mainMenuKeyboard, menuAction } from "./keyboards.js";
import { startCheckinFlow } from "./progress.js";

function mainMenuText(language: SupportedLanguage): string {
  return [
    t(language, "menu.title"),
    "",
    t(language, "menu.description"),
  ].join("\n");
}

const placeholderKeyByAction: Record<string, Parameters<typeof t>[1]> = {
  [menuAction.nutrition]: "menu.placeholder.nutrition",
  [menuAction.workout]: "menu.placeholder.workout",
  [menuAction.profile]: "menu.placeholder.profile",
  [menuAction.help]: "menu.placeholder.help",
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
  const key = callbackData ? placeholderKeyByAction[callbackData] : undefined;

  await ctx.answerCallbackQuery();

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
