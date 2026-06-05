import type { User as GrammyUser } from "grammy/types";

import { prisma } from "../db/prisma.js";

export async function upsertTelegramUser(from: GrammyUser) {
  const userData = {
    username: from.username ?? null,
    firstName: from.first_name,
    lastName: from.last_name ?? null,
    languageCode: from.language_code ?? null,
  };

  return prisma.user.upsert({
    where: {
      telegramId: BigInt(from.id),
    },
    create: {
      telegramId: BigInt(from.id),
      ...userData,
    },
    update: userData,
  });
}
