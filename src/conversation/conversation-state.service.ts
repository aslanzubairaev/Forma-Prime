import { ConversationStep, Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import type {
  ConversationPayload,
  ConversationStateSnapshot,
} from "./conversation-state.types.js";

const emptyPayload = Prisma.JsonNull;

export async function getConversationState(
  userId: string,
): Promise<ConversationStateSnapshot> {
  const state = await prisma.conversationState.findUnique({
    where: { userId },
  });

  return {
    step: state?.step ?? ConversationStep.IDLE,
    payload: (state?.payload as ConversationPayload | null) ?? null,
  };
}

export async function setConversationState(
  userId: string,
  step: ConversationStep,
  payload?: ConversationPayload,
): Promise<void> {
  await prisma.conversationState.upsert({
    where: { userId },
    create: {
      userId,
      step,
      payload: payload ?? emptyPayload,
    },
    update: {
      step,
      payload: payload ?? emptyPayload,
    },
  });
}

export async function resetConversationState(userId: string): Promise<void> {
  await setConversationState(userId, ConversationStep.IDLE);
}
