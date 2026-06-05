import type { Context } from "grammy";

import { mainMenuKeyboard, menuAction } from "./keyboards.js";

export const mainMenuText = [
  "Forma Prime",
  "",
  "Main menu is ready. These buttons are placeholders for the foundation phase.",
].join("\n");

const placeholderTextByAction: Record<string, string> = {
  [menuAction.nutrition]: "Nutrition module placeholder.",
  [menuAction.workout]: "Workout module placeholder.",
  [menuAction.checkin]: "Bodyweight check-in placeholder.",
  [menuAction.profile]: "Profile module placeholder.",
  [menuAction.help]: "Help placeholder.",
};

export async function replyWithMainMenu(ctx: Context): Promise<void> {
  await ctx.reply(mainMenuText, {
    reply_markup: mainMenuKeyboard(),
  });
}

export async function handleMainMenuAction(ctx: Context): Promise<void> {
  const callbackData = ctx.callbackQuery?.data;
  const text = callbackData ? placeholderTextByAction[callbackData] : undefined;

  await ctx.answerCallbackQuery();

  if (!text) {
    await ctx.reply("Unknown menu action.");
    return;
  }

  await ctx.reply(text, {
    reply_markup: mainMenuKeyboard(),
  });
}
