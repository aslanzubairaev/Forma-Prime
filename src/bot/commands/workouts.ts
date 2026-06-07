import type { Bot } from "grammy";

import { showWorkoutsFlow } from "../workout-logging.js";

export function registerWorkoutsCommand(bot: Bot): void {
  bot.command("workouts", showWorkoutsFlow);
}
