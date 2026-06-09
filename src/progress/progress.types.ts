import type { CheckinStatusLabel } from "@prisma/client";

export type WeightParseResult =
  | { status: "valid"; value: number }
  | { status: "invalid" }
  | { status: "out_of_range" };

export type BodyweightRecord = {
  id: string;
  weightKg: unknown;
  checkedAt: Date;
};

export type ProgressWeight = {
  id: string;
  weightKg: number;
  checkedAt: Date;
};

export type ProgressInsightLabel =
  | "no_data"
  | "first_entry"
  | "weight_stable"
  | "weight_trending_down"
  | "weight_trending_up"
  | "weight_change_attention";

export type WeeklyInsightLabel =
  | "no_activity"
  | "nutrition_only"
  | "training_only"
  | "mixed_activity"
  | "consistent_week";

export type CoachingHintKey =
  | "start_with_weight"
  | "log_second_weight"
  | "steady_progress"
  | "review_fast_change"
  | "keep_weekly_checkin"
  | "log_first_meal"
  | "add_workout"
  | "add_meal_logging"
  | "balanced_week"
  | "strong_consistency"
  | "use_recent_foods"
  | "use_latest_logs"
  | "use_reminders";

export type ProgressSummary =
  | {
      status: "empty";
      latest: null;
      previous: null;
      previousDelta: null;
      weekBaseline: null;
      weekDelta: null;
      insightLabel: ProgressInsightLabel;
      coachingHint: CoachingHintKey;
    }
  | {
      status: "partial" | "complete";
      latest: ProgressWeight;
      previous: ProgressWeight | null;
      previousDelta: number | null;
      weekBaseline: ProgressWeight | null;
      weekDelta: number | null;
      insightLabel: ProgressInsightLabel;
      coachingHint: CoachingHintKey;
    };

export type WeeklyCheckinPayload = {
  weightKg?: number;
  nutritionAdherence?: number;
  trainingAdherence?: number;
  energy?: number;
};

export type WeeklySummaryInput = {
  weightKg: number;
  previousWeightKg: number | null;
  mealCount: number;
  workoutCount: number;
  statusLabel: CheckinStatusLabel;
};

export type WeeklyRecapStatusLabel =
  | "on_track"
  | "good_consistency"
  | "needs_more_consistency"
  | "insufficient_data";

export type WeeklyRecapSummary = {
  mealCount: number;
  workoutCount: number;
  latestWeightKg: number | null;
  previousWeightKg: number | null;
  weightDeltaKg: number | null;
  statusLabel: WeeklyRecapStatusLabel;
  insightLabel: WeeklyInsightLabel;
  coachingHint: CoachingHintKey;
};
