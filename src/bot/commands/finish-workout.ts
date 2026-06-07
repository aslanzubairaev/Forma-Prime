import type { Bot } from "grammy";

import { finishWorkoutFlow } from "../workout-logging.js";

export function registerFinishWorkoutCommand(bot: Bot): void {
  bot.command("finishworkout", finishWorkoutFlow);
}
