import {
  BodyweightCheckinSource,
  CheckinStatusLabel,
  WorkoutSessionStatus,
  type Prisma,
} from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { t, type SupportedLanguage } from "../i18n/index.js";
import {
  getUserTimeZone,
  getZonedRecentWeekRange,
  getZonedWeekStartDate,
} from "../time/timezone.js";
import type {
  BodyweightRecord,
  CoachingHintKey,
  ProgressInsightLabel,
  ProgressSummary,
  ProgressWeight,
  WeeklyInsightLabel,
  WeeklyRecapSummary,
  WeeklyRecapStatusLabel,
  WeightParseResult,
  WeeklySummaryInput,
} from "./progress.types.js";

const minWeightKg = 30;
const maxWeightKg = 300;
const weekMs = 7 * 24 * 60 * 60 * 1000;

export function parseWeightKg(rawValue: string): WeightParseResult {
  const normalizedValue = rawValue.trim().replace(",", ".");

  if (!/^\d+(?:\.\d+)?$/.test(normalizedValue)) {
    return { status: "invalid" };
  }

  const value = Number(normalizedValue);

  if (!Number.isFinite(value)) {
    return { status: "invalid" };
  }

  if (value < minWeightKg || value > maxWeightKg) {
    return { status: "out_of_range" };
  }

  return { status: "valid", value: roundToOneDecimal(value) };
}

export function parseRating(rawValue: string): number | null {
  if (!/^[1-5]$/.test(rawValue.trim())) {
    return null;
  }

  return Number(rawValue.trim());
}

export function buildProgressSummary(
  records: BodyweightRecord[],
): ProgressSummary {
  const sortedRecords = records
    .map(toProgressWeight)
    .sort((left, right) => right.checkedAt.getTime() - left.checkedAt.getTime());
  const latest = sortedRecords[0] ?? null;

  if (!latest) {
    return {
      status: "empty",
      latest: null,
      previous: null,
      previousDelta: null,
      weekBaseline: null,
      weekDelta: null,
      insightLabel: "no_data",
      coachingHint: "start_with_weight",
    };
  }

  const previous = sortedRecords[1] ?? null;
  const latestWeekCutoff = new Date(latest.checkedAt.getTime() - weekMs);
  const weekBaseline =
    sortedRecords.find(
      (record) =>
        record.id !== latest.id &&
        record.checkedAt.getTime() <= latestWeekCutoff.getTime(),
    ) ?? null;

  const baseSummary: Omit<
    Extract<ProgressSummary, { status: "partial" | "complete" }>,
    "insightLabel" | "coachingHint"
  > = {
    status: previous ? "complete" : "partial",
    latest,
    previous,
    previousDelta: previous
      ? roundToOneDecimal(latest.weightKg - previous.weightKg)
      : null,
    weekBaseline,
    weekDelta: weekBaseline
      ? roundToOneDecimal(latest.weightKg - weekBaseline.weightKg)
      : null,
  };
  const insightLabel = getProgressInsightLabel(baseSummary);

  return {
    ...baseSummary,
    insightLabel,
    coachingHint: getProgressCoachingHint({
      ...baseSummary,
      insightLabel,
      coachingHint: "steady_progress",
    }),
  };
}

export async function getProgressSummary(userId: string): Promise<ProgressSummary> {
  const records = await prisma.bodyweightCheckin.findMany({
    where: {
      userId,
    },
    orderBy: [
      {
        checkedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return buildProgressSummary(records);
}

export async function getWeeklySummary(
  userId: string,
  referenceDate: Date = new Date(),
  timeZone?: string,
): Promise<WeeklyRecapSummary> {
  const userTimeZone = timeZone ?? (await getUserTimeZone(userId));
  const [activityCounts, records] = await Promise.all([
    getRecentProgressActivityCounts(userId, referenceDate, userTimeZone),
    prisma.bodyweightCheckin.findMany({
      where: {
        userId,
      },
      orderBy: [
        {
          checkedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
  ]);

  return buildWeeklySummary({
    mealCount: activityCounts.mealCount,
    workoutCount: activityCounts.workoutCount,
    progressSummary: buildProgressSummary(records),
  });
}

export function buildWeeklySummary(input: {
  mealCount: number;
  workoutCount: number;
  progressSummary: ProgressSummary;
}): WeeklyRecapSummary {
  const latestWeightKg =
    input.progressSummary.status === "empty"
      ? null
      : input.progressSummary.latest.weightKg;
  const previousWeightKg =
    input.progressSummary.status === "empty" ||
    input.progressSummary.previous === null
      ? null
      : input.progressSummary.previous.weightKg;
  const weightDeltaKg =
    input.progressSummary.status === "empty"
      ? null
      : input.progressSummary.previousDelta;

  return {
    mealCount: input.mealCount,
    workoutCount: input.workoutCount,
    latestWeightKg,
    previousWeightKg,
    weightDeltaKg,
    statusLabel: getWeeklyRecapStatusLabel(input),
    insightLabel: getWeeklyInsightLabel(input),
    coachingHint: getWeeklyCoachingHint(input),
  };
}

export function buildBodyweightCheckinCreateData(input: {
  userId: string;
  weightKg: number;
  source: BodyweightCheckinSource;
  recordedAt?: Date;
  notes?: string | null;
}): Prisma.BodyweightCheckinCreateInput {
  const data: Prisma.BodyweightCheckinCreateInput = {
    user: {
      connect: {
        id: input.userId,
      },
    },
    checkedAt: input.recordedAt ?? new Date(),
    weightKg: input.weightKg,
    source: input.source,
  };

  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  return data;
}

export async function logBodyweight(input: {
  userId: string;
  weightKg: number;
  source?: BodyweightCheckinSource;
  recordedAt?: Date;
  notes?: string | null;
}) {
  const dataInput: {
    userId: string;
    weightKg: number;
    source: BodyweightCheckinSource;
    recordedAt?: Date;
    notes?: string | null;
  } = {
    userId: input.userId,
    weightKg: input.weightKg,
    source: input.source ?? BodyweightCheckinSource.MANUAL,
  };

  if (input.recordedAt !== undefined) {
    dataInput.recordedAt = input.recordedAt;
  }

  if (input.notes !== undefined) {
    dataInput.notes = input.notes;
  }

  return prisma.bodyweightCheckin.create({
    data: buildBodyweightCheckinCreateData(dataInput),
  });
}

export function buildWeeklyCheckinCreateData(input: {
  userId: string;
  weekStartDate: Date;
  weightKg: number;
  nutritionAdherence: number;
  trainingAdherence: number;
  energy: number;
  notes: string | null;
  statusLabel: CheckinStatusLabel;
}): Prisma.WeeklyCheckinCreateInput {
  return {
    user: {
      connect: {
        id: input.userId,
      },
    },
    weekStartDate: input.weekStartDate,
    weightKg: input.weightKg,
    nutritionAdherence: input.nutritionAdherence,
    trainingAdherence: input.trainingAdherence,
    energy: input.energy,
    notes: input.notes,
    statusLabel: input.statusLabel,
  };
}

export async function completeWeeklyCheckin(input: {
  userId: string;
  weightKg: number;
  nutritionAdherence: number;
  trainingAdherence: number;
  energy: number;
  notes: string | null;
  referenceDate?: Date;
}): Promise<WeeklySummaryInput> {
  const referenceDate = input.referenceDate ?? new Date();
  const timeZone = await getUserTimeZone(input.userId);
  const [previousBodyweight, activityCounts] = await Promise.all([
    prisma.bodyweightCheckin.findFirst({
      where: {
        userId: input.userId,
      },
      orderBy: [
        {
          checkedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
    getRecentProgressActivityCounts(input.userId, referenceDate, timeZone),
  ]);
  const statusLabel = getWeeklyStatusLabel(activityCounts);

  await prisma.$transaction([
    prisma.bodyweightCheckin.create({
      data: buildBodyweightCheckinCreateData({
        userId: input.userId,
        weightKg: input.weightKg,
        source: BodyweightCheckinSource.WEEKLY_CHECKIN,
        recordedAt: referenceDate,
        notes: input.notes,
      }),
    }),
    prisma.weeklyCheckin.create({
      data: buildWeeklyCheckinCreateData({
        userId: input.userId,
        weekStartDate: getWeekStartDate(referenceDate, timeZone),
        weightKg: input.weightKg,
        nutritionAdherence: input.nutritionAdherence,
        trainingAdherence: input.trainingAdherence,
        energy: input.energy,
        notes: input.notes,
        statusLabel,
      }),
    }),
  ]);

  return {
    weightKg: input.weightKg,
    previousWeightKg: previousBodyweight
      ? Number(previousBodyweight.weightKg)
      : null,
    mealCount: activityCounts.mealCount,
    workoutCount: activityCounts.workoutCount,
    statusLabel,
  };
}

export async function getRecentProgressActivityCounts(
  userId: string,
  referenceDate: Date = new Date(),
  timeZone?: string,
): Promise<{ mealCount: number; workoutCount: number }> {
  const { start, end } = getRecentWeekRange(
    referenceDate,
    timeZone ?? (await getUserTimeZone(userId)),
  );
  const [mealCount, workoutCount] = await Promise.all([
    prisma.mealEntry.count({
      where: {
        userId,
        consumedAt: {
          gte: start,
          lt: end,
        },
      },
    }),
    prisma.workoutSession.count({
      where: {
        userId,
        status: {
          not: WorkoutSessionStatus.CANCELLED,
        },
        startedAt: {
          gte: start,
          lt: end,
        },
      },
    }),
  ]);

  return {
    mealCount,
    workoutCount,
  };
}

export function getRecentWeekRange(
  referenceDate: Date,
  timeZone?: string,
): {
  start: Date;
  end: Date;
} {
  return getZonedRecentWeekRange(referenceDate, timeZone);
}

export function getWeekStartDate(date: Date, timeZone?: string): Date {
  return getZonedWeekStartDate(date, timeZone);
}

export function getWeeklyStatusLabel(input: {
  mealCount: number;
  workoutCount: number;
}): CheckinStatusLabel {
  if (input.mealCount === 0 && input.workoutCount === 0) {
    return CheckinStatusLabel.INSUFFICIENT_DATA;
  }

  if (input.mealCount > 0 && input.workoutCount > 0) {
    return CheckinStatusLabel.ON_TRACK;
  }

  return CheckinStatusLabel.NEEDS_CONSISTENCY;
}

export function buildWeeklyCheckinSummary(
  language: SupportedLanguage,
  input: WeeklySummaryInput,
): string {
  return [
    t(language, "checkin.completed"),
    t(language, "checkin.summary.weight", {
      weight: formatWeight(input.weightKg),
    }),
    input.previousWeightKg === null
      ? t(language, "checkin.summary.changeUnavailable")
      : t(language, "checkin.summary.change", {
          delta: formatSignedDelta(input.weightKg - input.previousWeightKg),
        }),
    t(language, "checkin.summary.meals", { count: input.mealCount }),
    t(language, "checkin.summary.workouts", { count: input.workoutCount }),
    t(language, "checkin.summary.status", {
      status: t(language, statusLabelKey[input.statusLabel]),
    }),
  ].join("\n");
}

export function formatWeeklySummary(
  language: SupportedLanguage,
  summary: WeeklyRecapSummary,
): string {
  return [
    t(language, "summary.title"),
    t(language, "summary.meals", { count: summary.mealCount }),
    t(language, "summary.workouts", { count: summary.workoutCount }),
    summary.latestWeightKg === null
      ? t(language, "summary.weightUnavailable")
      : t(language, "summary.latestWeight", {
          weight: formatWeight(summary.latestWeightKg),
        }),
    summary.weightDeltaKg === null
      ? t(language, "summary.weightChangeUnavailable")
      : t(language, "summary.weightChange", {
          delta: formatSignedDelta(summary.weightDeltaKg),
        }),
    t(language, "summary.status", {
      status: t(language, weeklyRecapStatusLabelKey[summary.statusLabel]),
    }),
    t(language, "summary.insight", {
      insight: t(language, weeklyInsightLabelKey[summary.insightLabel]),
    }),
    t(language, "summary.hint", {
      hint: t(language, coachingHintKey[summary.coachingHint]),
    }),
  ].join("\n");
}

export function formatProgressSummary(
  language: SupportedLanguage,
  summary: ProgressSummary,
): string {
  if (summary.status === "empty") {
    return t(language, "progress.empty");
  }

  return [
    t(language, "progress.title"),
    t(language, "progress.latest", {
      weight: formatWeight(summary.latest.weightKg),
    }),
    summary.previous
      ? t(language, "progress.previous", {
          weight: formatWeight(summary.previous.weightKg),
        })
      : t(language, "progress.previousUnavailable"),
    summary.previousDelta === null
      ? t(language, "progress.deltaPreviousUnavailable")
      : t(language, "progress.deltaPrevious", {
          delta: formatSignedDelta(summary.previousDelta),
        }),
    summary.weekDelta === null
      ? t(language, "progress.deltaWeekUnavailable")
      : t(language, "progress.deltaWeek", {
          delta: formatSignedDelta(summary.weekDelta),
        }),
    t(language, "progress.insight", {
      insight: t(language, progressInsightLabelKey[summary.insightLabel]),
    }),
    t(language, "progress.hint", {
      hint: t(language, coachingHintKey[summary.coachingHint]),
    }),
    summary.status === "partial"
      ? t(language, "progress.insufficientComparison")
      : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function formatWeight(value: number): string {
  return value.toFixed(1);
}

function formatSignedDelta(value: number): string {
  const roundedValue = roundToOneDecimal(value);
  return `${roundedValue > 0 ? "+" : ""}${roundedValue.toFixed(1)}`;
}

const statusLabelKey: Record<CheckinStatusLabel, Parameters<typeof t>[1]> = {
  [CheckinStatusLabel.ON_TRACK]: "checkin.status.onTrack",
  [CheckinStatusLabel.NEEDS_CONSISTENCY]: "checkin.status.needsConsistency",
  [CheckinStatusLabel.INSUFFICIENT_DATA]: "checkin.status.insufficientData",
};

const weeklyRecapStatusLabelKey: Record<
  WeeklyRecapStatusLabel,
  Parameters<typeof t>[1]
> = {
  on_track: "summary.status.onTrack",
  good_consistency: "summary.status.goodConsistency",
  needs_more_consistency: "summary.status.needsMoreConsistency",
  insufficient_data: "summary.status.insufficientData",
};

const progressInsightLabelKey: Record<
  ProgressInsightLabel,
  Parameters<typeof t>[1]
> = {
  no_data: "progress.insight.noData",
  first_entry: "progress.insight.firstEntry",
  weight_stable: "progress.insight.weightStable",
  weight_trending_down: "progress.insight.weightTrendingDown",
  weight_trending_up: "progress.insight.weightTrendingUp",
  weight_change_attention: "progress.insight.weightChangeAttention",
};

const weeklyInsightLabelKey: Record<
  WeeklyInsightLabel,
  Parameters<typeof t>[1]
> = {
  no_activity: "summary.insight.noActivity",
  nutrition_only: "summary.insight.nutritionOnly",
  training_only: "summary.insight.trainingOnly",
  mixed_activity: "summary.insight.mixedActivity",
  consistent_week: "summary.insight.consistentWeek",
};

const coachingHintKey: Record<CoachingHintKey, Parameters<typeof t>[1]> = {
  start_with_weight: "coach.hint.startWithWeight",
  log_second_weight: "coach.hint.logSecondWeight",
  steady_progress: "coach.hint.steadyProgress",
  review_fast_change: "coach.hint.reviewFastChange",
  keep_weekly_checkin: "coach.hint.keepWeeklyCheckin",
  log_first_meal: "coach.hint.logFirstMeal",
  add_workout: "coach.hint.addWorkout",
  add_meal_logging: "coach.hint.addMealLogging",
  balanced_week: "coach.hint.balancedWeek",
  strong_consistency: "coach.hint.strongConsistency",
  use_recent_foods: "coach.hint.useRecentFoods",
  use_latest_logs: "coach.hint.useLatestLogs",
  use_reminders: "coach.hint.useReminders",
};

function getWeeklyRecapStatusLabel(input: {
  mealCount: number;
  workoutCount: number;
}): WeeklyRecapStatusLabel {
  if (input.mealCount === 0 && input.workoutCount === 0) {
    return "insufficient_data";
  }

  if (input.mealCount >= 7 && input.workoutCount >= 2) {
    return "on_track";
  }

  if (input.mealCount > 0 && input.workoutCount > 0) {
    return "good_consistency";
  }

  return "needs_more_consistency";
}

export function getProgressInsightLabel(
  summary:
    | ProgressSummary
    | Omit<
        Extract<ProgressSummary, { status: "partial" | "complete" }>,
        "insightLabel" | "coachingHint"
      >,
): ProgressInsightLabel {
  if (summary.status === "empty") {
    return "no_data";
  }

  if (summary.previous === null) {
    return "first_entry";
  }

  const delta = summary.weekDelta ?? summary.previousDelta ?? 0;

  if (Math.abs(delta) >= 1.5) {
    return "weight_change_attention";
  }

  if (Math.abs(delta) <= 0.3) {
    return "weight_stable";
  }

  return delta < 0 ? "weight_trending_down" : "weight_trending_up";
}

export function getProgressCoachingHint(
  summary: ProgressSummary,
): CoachingHintKey {
  if (summary.status === "empty") {
    return "start_with_weight";
  }

  if (summary.status === "partial") {
    return "log_second_weight";
  }

  if (summary.insightLabel === "weight_change_attention") {
    return "review_fast_change";
  }

  if (summary.weekDelta !== null) {
    return "keep_weekly_checkin";
  }

  return "steady_progress";
}

export function getWeeklyInsightLabel(input: {
  mealCount: number;
  workoutCount: number;
}): WeeklyInsightLabel {
  if (input.mealCount === 0 && input.workoutCount === 0) {
    return "no_activity";
  }

  if (input.mealCount >= 7 && input.workoutCount >= 2) {
    return "consistent_week";
  }

  if (input.mealCount > 0 && input.workoutCount > 0) {
    return "mixed_activity";
  }

  return input.mealCount > 0 ? "nutrition_only" : "training_only";
}

export function getWeeklyCoachingHint(input: {
  mealCount: number;
  workoutCount: number;
  progressSummary: ProgressSummary;
}): CoachingHintKey {
  if (input.mealCount === 0 && input.workoutCount === 0) {
    return input.progressSummary.status === "empty"
      ? "start_with_weight"
      : "log_first_meal";
  }

  if (input.mealCount > 0 && input.workoutCount === 0) {
    return "add_workout";
  }

  if (input.mealCount === 0 && input.workoutCount > 0) {
    return "add_meal_logging";
  }

  if (input.mealCount >= 7 && input.workoutCount >= 2) {
    return "strong_consistency";
  }

  if (input.mealCount >= 3 && input.workoutCount >= 1) {
    return "use_recent_foods";
  }

  if (input.progressSummary.status !== "empty") {
    return "use_latest_logs";
  }

  return "use_reminders";
}

function toProgressWeight(record: BodyweightRecord): ProgressWeight {
  return {
    id: record.id,
    weightKg: Number(record.weightKg),
    checkedAt: record.checkedAt,
  };
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
