import type { LearnedFoodCandidate, Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { normalizeFoodText } from "./food-normalization.js";
import type { NutritionFoodRecord } from "./food.types.js";

export type StructuredLearnedFoodFallback = {
  canonicalName: string;
  displayName: string;
  aliases: string[];
  category?: string | null;
  servingGrams?: number | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  confidence: number;
  isEstimate: boolean;
  needsClarification: boolean;
};

export type SaveOpenAiLearnedFoodInput = {
  userId: string | null;
  rawInput: string;
  normalizedInput?: string;
  fallback: StructuredLearnedFoodFallback;
};

export type LearnedFoodCandidateRecord = {
  id: string;
  userId: string | null;
  rawInput: string;
  normalizedInput: string;
  canonicalName: string;
  displayName: string;
  category: string | null;
  servingGrams: unknown;
  caloriesPer100g: unknown;
  proteinPer100g: unknown;
  fatPer100g: unknown;
  carbsPer100g: unknown;
  confidence: unknown;
  isEstimate: boolean;
  aliasesJson: unknown;
  source: string;
  timesSeen: number;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
};

type LearnedFoodDelegate = PrismaClient["learnedFoodCandidate"];

export async function findLearnedFoodCandidateMatch(
  userId: string,
  rawInput: string,
  delegate: Pick<LearnedFoodDelegate, "findMany"> = prisma.learnedFoodCandidate,
): Promise<LearnedFoodCandidateRecord | null> {
  const normalizedInput = normalizeFoodText(rawInput);

  if (!normalizedInput) {
    return null;
  }

  const candidates = await delegate.findMany({
    where: {
      rejectedAt: null,
      OR: [
        {
          userId,
        },
        {
          userId: null,
        },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 100,
  });

  return (
    findExactNormalizedMatch(candidates, normalizedInput, userId) ??
    findExactAliasMatch(candidates, normalizedInput, userId)
  );
}

export async function incrementLearnedFoodTimesSeen(
  record: LearnedFoodCandidateRecord,
  delegate: Pick<LearnedFoodDelegate, "update"> = prisma.learnedFoodCandidate,
): Promise<LearnedFoodCandidateRecord> {
  return delegate.update({
    where: {
      id: record.id,
    },
    data: {
      timesSeen: {
        increment: 1,
      },
    },
  });
}

export async function saveOpenAiLearnedFoodCandidate(
  input: SaveOpenAiLearnedFoodInput,
  delegate: Pick<LearnedFoodDelegate, "create" | "findFirst" | "update"> =
    prisma.learnedFoodCandidate,
): Promise<LearnedFoodCandidateRecord> {
  const normalizedInput =
    input.normalizedInput ?? normalizeFoodText(input.rawInput);
  const existing = await delegate.findFirst({
    where: {
      userId: input.userId,
      normalizedInput,
      rejectedAt: null,
    },
  });

  if (existing) {
    return delegate.update({
      where: {
        id: existing.id,
      },
      data: {
        ...buildLearnedFoodCandidateUpdateData(input),
        timesSeen: {
          increment: 1,
        },
      },
    });
  }

  return delegate.create({
    data: buildLearnedFoodCandidateCreateData({
      ...input,
      normalizedInput,
    }),
  });
}

export function buildLearnedFoodCandidateCreateData(
  input: SaveOpenAiLearnedFoodInput,
): Prisma.LearnedFoodCandidateUncheckedCreateInput {
  const normalizedInput =
    input.normalizedInput ?? normalizeFoodText(input.rawInput);

  return {
    userId: input.userId,
    rawInput: input.rawInput.trim(),
    normalizedInput,
    canonicalName: input.fallback.canonicalName.trim(),
    displayName: input.fallback.displayName.trim(),
    category: input.fallback.category?.trim() || null,
    servingGrams: input.fallback.servingGrams ?? null,
    caloriesPer100g: input.fallback.caloriesPer100g,
    proteinPer100g: input.fallback.proteinPer100g,
    fatPer100g: input.fallback.fatPer100g,
    carbsPer100g: input.fallback.carbsPer100g,
    confidence: input.fallback.confidence,
    isEstimate: input.fallback.isEstimate,
    aliasesJson: input.fallback.aliases,
    source: "openai_fallback",
    timesSeen: 1,
  };
}

export function learnedFoodCandidateToNutritionFoodRecord(
  record: LearnedFoodCandidateRecord,
): NutritionFoodRecord {
  const aliases = [
    record.rawInput,
    record.normalizedInput,
    ...readAliases(record.aliasesJson),
  ];

  return {
    id: record.id,
    slug: `learned-${record.id}`,
    nameRu: record.displayName,
    nameEn: record.displayName,
    isLearned: true,
    caloriesPer100g: record.caloriesPer100g,
    proteinPer100g: record.proteinPer100g,
    fatPer100g: record.fatPer100g,
    carbsPer100g: record.carbsPer100g,
    aliases: uniqueNormalizedAliases(aliases).map((alias) => ({
      alias,
      languageCode: "learned",
      normalizedAlias: normalizeFoodText(alias),
    })),
  };
}

function buildLearnedFoodCandidateUpdateData(
  input: SaveOpenAiLearnedFoodInput,
): Prisma.LearnedFoodCandidateUncheckedUpdateInput {
  return {
    rawInput: input.rawInput.trim(),
    canonicalName: input.fallback.canonicalName.trim(),
    displayName: input.fallback.displayName.trim(),
    category: input.fallback.category?.trim() || null,
    servingGrams: input.fallback.servingGrams ?? null,
    caloriesPer100g: input.fallback.caloriesPer100g,
    proteinPer100g: input.fallback.proteinPer100g,
    fatPer100g: input.fallback.fatPer100g,
    carbsPer100g: input.fallback.carbsPer100g,
    confidence: input.fallback.confidence,
    isEstimate: input.fallback.isEstimate,
    aliasesJson: input.fallback.aliases,
    source: "openai_fallback",
  };
}

function findExactNormalizedMatch(
  candidates: LearnedFoodCandidate[],
  normalizedInput: string,
  userId: string,
): LearnedFoodCandidateRecord | null {
  return (
    prioritizeUserCandidates(candidates, userId).find(
      (candidate) => candidate.normalizedInput === normalizedInput,
    ) ?? null
  );
}

function findExactAliasMatch(
  candidates: LearnedFoodCandidate[],
  normalizedInput: string,
  userId: string,
): LearnedFoodCandidateRecord | null {
  return (
    prioritizeUserCandidates(candidates, userId).find((candidate) =>
      readAliases(candidate.aliasesJson).some(
        (alias) => normalizeFoodText(alias) === normalizedInput,
      ),
    ) ?? null
  );
}

function prioritizeUserCandidates(
  candidates: LearnedFoodCandidate[],
  userId: string,
): LearnedFoodCandidate[] {
  return [...candidates].sort((left, right) => {
    if (left.userId === userId && right.userId !== userId) {
      return -1;
    }

    if (right.userId === userId && left.userId !== userId) {
      return 1;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

function readAliases(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((alias): alias is string => typeof alias === "string");
}

function uniqueNormalizedAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const alias of aliases) {
    const normalizedAlias = normalizeFoodText(alias);

    if (!normalizedAlias || seen.has(normalizedAlias)) {
      continue;
    }

    seen.add(normalizedAlias);
    result.push(alias.trim());
  }

  return result;
}
