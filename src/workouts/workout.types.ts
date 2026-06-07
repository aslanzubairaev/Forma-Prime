import type { ExerciseLog, WorkoutDay, WorkoutSession } from "@prisma/client";

export type ParsedWorkoutSet = {
  rawText: string;
  exerciseName: string;
  normalizedExerciseName: string;
  weightKg: number | null;
  reps: number;
};

export type ExerciseChoice = {
  id: string;
  name: string;
};

export type WorkoutSessionWithLogs = WorkoutSession & {
  workoutDay?: WorkoutDay | null;
  logs: ExerciseLog[];
};

export type WorkoutSessionSummary = {
  title: string | null;
  exerciseCount: number;
  totalSets: number;
  latestSets: Array<{
    exerciseName: string;
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
  }>;
};
