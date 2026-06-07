import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WorkoutSessionStatus } from "@prisma/client";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const { parseWorkoutSet } = await import("../src/workouts/workout-parser.js");
const {
  buildExerciseLogCreateData,
  buildWorkoutSessionSummary,
  canAcceptWorkoutLog,
  getNextSetNumber,
  selectActiveWorkoutSession,
} = await import("../src/workouts/workout.service.js");

describe("workout parser", () => {
  it("parses bench press 60 x 8", () => {
    const parsed = parseWorkoutSet("bench press 60 x 8");

    assert.equal(parsed?.exerciseName, "bench press");
    assert.equal(parsed?.weightKg, 60);
    assert.equal(parsed?.reps, 8);
  });

  it("parses bench press 60kg x 8", () => {
    const parsed = parseWorkoutSet("bench press 60kg x 8");

    assert.equal(parsed?.exerciseName, "bench press");
    assert.equal(parsed?.weightKg, 60);
    assert.equal(parsed?.reps, 8);
  });

  it("parses жим лежа 60 x 8", () => {
    const parsed = parseWorkoutSet("жим лежа 60 x 8");

    assert.equal(parsed?.exerciseName, "жим лежа");
    assert.equal(parsed?.weightKg, 60);
    assert.equal(parsed?.reps, 8);
  });

  it("parses pull up x 10", () => {
    const parsed = parseWorkoutSet("pull up x 10");

    assert.equal(parsed?.exerciseName, "pull up");
    assert.equal(parsed?.weightKg, null);
    assert.equal(parsed?.reps, 10);
  });

  it("rejects invalid garbage safely", () => {
    assert.equal(parseWorkoutSet("today was hard"), null);
  });
});

describe("workout session rules", () => {
  it("resumes the latest active session", () => {
    const active = selectActiveWorkoutSession([
      {
        id: "completed",
        status: WorkoutSessionStatus.COMPLETED,
        startedAt: new Date("2026-06-06T10:00:00.000Z"),
      },
      {
        id: "older-active",
        status: WorkoutSessionStatus.IN_PROGRESS,
        startedAt: new Date("2026-06-06T11:00:00.000Z"),
      },
      {
        id: "latest-active",
        status: WorkoutSessionStatus.PLANNED,
        startedAt: new Date("2026-06-06T12:00:00.000Z"),
      },
    ]);

    assert.equal(active?.id, "latest-active");
  });

  it("does not accept logs for completed sessions", () => {
    assert.equal(
      canAcceptWorkoutLog({ status: WorkoutSessionStatus.COMPLETED }),
      false,
    );
    assert.equal(
      canAcceptWorkoutLog({ status: WorkoutSessionStatus.IN_PROGRESS }),
      true,
    );
  });
});

describe("workout set numbering", () => {
  it("starts first set at 1", () => {
    assert.equal(getNextSetNumber([], "bench press"), 1);
  });

  it("increments next set for the same exercise", () => {
    const nextSet = getNextSetNumber(
      [
        {
          exerciseId: "exercise_bench",
          exerciseName: "Bench Press",
          setNumber: 1,
        },
        {
          exerciseId: "exercise_bench",
          exerciseName: "Bench Press",
          setNumber: 2,
        },
      ],
      "bench press",
      "exercise_bench",
    );

    assert.equal(nextSet, 3);
  });
});

describe("workout persistence payloads", () => {
  it("builds ExerciseLog data for linked exercise", () => {
    const data = buildExerciseLogCreateData({
      workoutSessionId: "session_1",
      exerciseId: "exercise_1",
      exerciseName: "Bench press",
      setNumber: 1,
      weightKg: 60,
      reps: 8,
    }) as any;

    assert.equal(data.workoutSession.connect.id, "session_1");
    assert.equal(data.exercise.connect.id, "exercise_1");
    assert.equal(data.exerciseName, "Bench press");
    assert.equal(data.setNumber, 1);
    assert.equal(data.weightKg, 60);
    assert.equal(data.reps, 8);
  });

  it("builds ExerciseLog data for manual exercise without exerciseId", () => {
    const data = buildExerciseLogCreateData({
      workoutSessionId: "session_1",
      exerciseId: null,
      exerciseName: "Pull up",
      setNumber: 1,
      weightKg: null,
      reps: 10,
    }) as any;

    assert.equal(data.exercise, undefined);
    assert.equal(data.exerciseName, "Pull up");
    assert.equal(data.weightKg, null);
    assert.equal(data.reps, 10);
  });
});

describe("workout summaries", () => {
  it("builds active session summary", () => {
    const summary = buildWorkoutSessionSummary({
      workoutDay: {
        id: "day_1",
        workoutSplitId: "split_1",
        name: "Upper",
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      logs: [
        logFor("Bench press", 1, 60, 8),
        logFor("Bench press", 2, 60, 8),
        logFor("Pull up", 1, null, 10),
      ],
    } as any);

    assert.equal(summary.title, "Upper");
    assert.equal(summary.exerciseCount, 2);
    assert.equal(summary.totalSets, 3);
  });

  it("builds manual finish summary", () => {
    const summary = buildWorkoutSessionSummary({
      workoutDay: null,
      logs: [logFor("Pull up", 1, null, 10)],
    } as any);

    assert.equal(summary.title, null);
    assert.equal(summary.exerciseCount, 1);
    assert.equal(summary.totalSets, 1);
  });
});

function logFor(
  exerciseName: string,
  setNumber: number,
  weightKg: number | null,
  reps: number,
) {
  return {
    id: `${exerciseName}_${setNumber}`,
    workoutSessionId: "session_1",
    exerciseId: null,
    exerciseName,
    setNumber,
    weightKg,
    reps,
    rpe: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
