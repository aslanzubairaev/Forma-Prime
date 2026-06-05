import { ConversationStep } from "@prisma/client";
import type { Bot } from "grammy";

import { resetConversationState } from "../../conversation/conversation-state.service.js";
import { upsertTelegramUser } from "../../users/user.service.js";
import { replyWithMainMenu } from "../menu.js";

export function registerStartCommand(bot: Bot): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Telegram user context is missing.");
      return;
    }

    const user = await upsertTelegramUser(ctx.from);
    await resetConversationState(user.id);

    await ctx.reply(`Welcome to Forma Prime. State: ${ConversationStep.IDLE}.`);
    await replyWithMainMenu(ctx);
  });
}
