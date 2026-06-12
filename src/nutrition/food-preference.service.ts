import type { FoodPreference, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import {
  getFoodClarificationChoiceBySlug,
  type FoodClarificationChoice,
} from "./food-ambiguity.service.js";
import { normalizeFoodText } from "./food-normalization.js";

export type FoodPreferenceRecord = {
  id: string;
  userId: string;
  triggerInput: string;
  normalizedTriggerInput: string;
  preferredCanonicalName: string;
  preferredDisplayName: string;
  preferredFoodSlug: string;
  preferredServingGrams: unknown;
  preferenceKind: string;
  confirmationCount: number;
  lastConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
};

type FoodPreferenceDelegate = PrismaClient["foodPreference"];

const clarificationPreferenceKind = "clarification_choice";

export async function findActiveFoodPreference(
  input: {
    userId: string;
    triggerInput: string;
  },
  delegate: Pick<FoodPreferenceDelegate, "findFirst"> = prisma.foodPreference,
): Promise<FoodPreferenceRecord | null> {
  const normalizedTriggerInput = normalizeFoodText(input.triggerInput);

  if (!normalizedTriggerInput) {
    return null;
  }

  return delegate.findFirst({
    where: {
      userId: input.userId,
      normalizedTriggerInput,
      preferenceKind: clarificationPreferenceKind,
      isActive: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function upsertFoodPreference(
  input: {
    userId: string;
    triggerInput: string;
    choice: FoodClarificationChoice;
  },
  delegate: Pick<FoodPreferenceDelegate, "upsert"> = prisma.foodPreference,
): Promise<FoodPreferenceRecord> {
  return delegate.upsert(buildFoodPreferenceUpsertArgs(input));
}

export async function incrementFoodPreferenceConfirmation(
  preference: FoodPreferenceRecord,
  delegate: Pick<FoodPreferenceDelegate, "update"> = prisma.foodPreference,
): Promise<FoodPreferenceRecord> {
  return delegate.update({
    where: {
      id: preference.id,
    },
    data: {
      confirmationCount: {
        increment: 1,
      },
      lastConfirmedAt: new Date(),
      isActive: true,
    },
  });
}

export function buildFoodPreferenceUpsertArgs(input: {
  userId: string;
  triggerInput: string;
  choice: FoodClarificationChoice;
}): Prisma.FoodPreferenceUpsertArgs {
  const normalizedTriggerInput = normalizeFoodText(input.triggerInput);
  const triggerInput = input.triggerInput.trim();

  return {
    where: {
      userId_normalizedTriggerInput_preferenceKind: {
        userId: input.userId,
        normalizedTriggerInput,
        preferenceKind: clarificationPreferenceKind,
      },
    },
    create: {
      userId: input.userId,
      triggerInput,
      normalizedTriggerInput,
      preferredCanonicalName: input.choice.canonicalName,
      preferredDisplayName: input.choice.displayNameRu,
      preferredFoodSlug: input.choice.foodSlug,
      preferredServingGrams: input.choice.servingGrams,
      preferenceKind: clarificationPreferenceKind,
      confirmationCount: 1,
      lastConfirmedAt: new Date(),
      isActive: true,
    },
    update: {
      triggerInput,
      preferredCanonicalName: input.choice.canonicalName,
      preferredDisplayName: input.choice.displayNameRu,
      preferredFoodSlug: input.choice.foodSlug,
      preferredServingGrams: input.choice.servingGrams,
      preferenceKind: clarificationPreferenceKind,
      confirmationCount: {
        increment: 1,
      },
      lastConfirmedAt: new Date(),
      isActive: true,
    },
  };
}

export function foodPreferenceToClarificationChoice(
  preference: FoodPreferenceRecord,
): FoodClarificationChoice | null {
  const choice = getFoodClarificationChoiceBySlug(preference.preferredFoodSlug);

  if (!choice) {
    return null;
  }

  return {
    ...choice,
    canonicalName: preference.preferredCanonicalName,
    displayNameRu: preference.preferredDisplayName,
    servingGrams: Number(preference.preferredServingGrams ?? choice.servingGrams),
  };
}

export function isFoodPreferenceRecord(
  value: FoodPreference | FoodPreferenceRecord | null,
): value is FoodPreferenceRecord {
  return value !== null;
}
