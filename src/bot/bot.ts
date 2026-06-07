import { Bot } from "grammy";
import pino from "pino";

import { env } from "../config/env.js";
import { menuAction } from "./keyboards.js";
import { handleMainMenuAction } from "./menu.js";
import { registerFoodCommand } from "./commands/food.js";
import { registerFinishWorkoutCommand } from "./commands/finish-workout.js";
import { registerMealsCommand } from "./commands/meals.js";
import { registerStartCommand } from "./commands/start.js";
import { registerTodayCommand } from "./commands/today.js";
import { registerWorkoutCommand } from "./commands/workout.js";
import { registerWorkoutsCommand } from "./commands/workouts.js";
import { registerFoodLoggingHandlers } from "./food-logging.js";
import { registerOnboardingHandlers } from "./onboarding.js";
import { registerProgressHandlers } from "./progress.js";
import { registerWorkoutLoggingHandlers } from "./workout-logging.js";

const logger = pino({ level: env.LOG_LEVEL });

export function createBot(): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  registerStartCommand(bot);
  registerFoodCommand(bot);
  registerTodayCommand(bot);
  registerMealsCommand(bot);
  registerWorkoutCommand(bot);
  registerWorkoutsCommand(bot);
  registerFinishWorkoutCommand(bot);
  registerOnboardingHandlers(bot);
  registerProgressHandlers(bot);
  registerWorkoutLoggingHandlers(bot);
  registerFoodLoggingHandlers(bot);

  const menuActionsPattern = new RegExp(
    `^(${Object.values(menuAction).join("|")})$`,
  );

  bot.callbackQuery(menuActionsPattern, handleMainMenuAction);

  bot.catch((error) => {
    logger.error({ error }, "Bot update failed");
  });

  return bot;
}
