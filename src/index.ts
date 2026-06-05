import { createBot } from "./bot/bot.js";
import { disconnectPrisma } from "./db/prisma.js";

const bot = createBot();

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.info(`Received ${signal}. Shutting down...`);
  await bot.stop();
  await disconnectPrisma();
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

bot.start().catch(async (error: unknown) => {
  console.error("Bot startup failed", error);
  await disconnectPrisma();
  process.exitCode = 1;
});
