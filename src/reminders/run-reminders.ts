import { Bot } from "grammy";

import { env } from "../config/env.js";
import { disconnectPrisma } from "../db/prisma.js";
import { runReminderDelivery } from "./reminder.runner.js";

const bot = new Bot(env.BOT_TOKEN);

runReminderDelivery({ bot })
  .then((result) => {
    console.info(`Reminder delivery completed. Sent: ${result.sentCount}`);
  })
  .catch((error: unknown) => {
    console.error("Reminder delivery failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
