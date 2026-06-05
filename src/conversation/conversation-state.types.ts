import type { ConversationStep, Prisma } from "@prisma/client";

export type ConversationPayload = Prisma.JsonObject;

export type ConversationStateSnapshot = {
  step: ConversationStep;
  payload: ConversationPayload | null;
};
