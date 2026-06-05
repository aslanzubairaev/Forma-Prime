import { Bot } from "grammy";
import pino from "pino";

import { env } from "../config/env.js";
import { menuAction } from "./keyboards.js";
import { handleMainMenuAction } from "./menu.js";
import { registerStartCommand } from "./commands/start.js";

const logger = pino({ level: env.LOG_LEVEL });

export function createBot(): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  registerStartCommand(bot);

  const menuActionsPattern = new RegExp(
    `^(${Object.values(menuAction).join("|")})$`,
  );

  bot.callbackQuery(menuActionsPattern, handleMainMenuAction);

  bot.catch((error) => {
    logger.error({ error }, "Bot update failed");
  });

  return bot;
}
