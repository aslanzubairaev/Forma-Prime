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

export type ProgressSummary =
  | {
      status: "empty";
      latest: null;
      previous: null;
      previousDelta: null;
      weekBaseline: null;
      weekDelta: null;
    }
  | {
      status: "partial" | "complete";
      latest: ProgressWeight;
      previous: ProgressWeight | null;
      previousDelta: number | null;
      weekBaseline: ProgressWeight | null;
      weekDelta: number | null;
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
