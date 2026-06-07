import type { Bot } from "grammy";

import { startWorkoutFlow } from "../workout-logging.js";

export function registerWorkoutCommand(bot: Bot): void {
  bot.command("workout", startWorkoutFlow);
}
