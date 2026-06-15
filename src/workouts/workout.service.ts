import type {
  Prisma,
  WorkoutSessionStatus as WorkoutSessionStatusType,
} from "@prisma/client";

import { prisma } from "../db/prisma.js";
import { WorkoutSessionStatus } from "../db/prisma-client.js";
import { getUserDayRange } from "../meals/meals.service.js";
import { normalizeExerciseName } from "./workout-parser.js";
import type {
  ExerciseChoice,
  ParsedWorkoutSet,
  WorkoutSessionSummary,
  WorkoutSessionWithLogs,
} from "./workout.types.js";

const activeWorkoutStatuses: WorkoutSessionStatusType[] = [
  WorkoutSessionStatus.PLANNED,
  WorkoutSessionStatus.IN_PROGRESS,
];

export type LatestWorkoutLog = Prisma.ExerciseLogGetPayload<{
  include: {
    workoutSession: {
      include: {
        workoutDay: true;
      };
    };
  };
}>;

export function isActiveWorkoutStatus(status: WorkoutSessionStatusType): boolean {
  return activeWorkoutStatuses.includes(status);
}

export function selectActiveWorkoutSession<T extends {
  status: WorkoutSessionStatusType;
  startedAt: Date;
}>(sessions: T[]): T | null {
  return (
    sessions
      .filter((session) => isActiveWorkoutStatus(session.status))
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0] ??
    null
  );
}

export async function getActiveWorkoutSession(userId: string) {
  return prisma.workoutSession.findFirst({
    where: {
      userId,
      status: {
        in: activeWorkoutStatuses,
      },
    },
    include: {
      workoutDay: true,
      logs: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getActiveWorkoutSplit(userId: string) {
  return prisma.workoutSplit.findFirst({
    where: {
      userId,
      isActive: true,
    },
    include: {
      days: {
        include: {
          exercises: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function startManualWorkoutSession(userId: string) {
  const active = await getActiveWorkoutSession(userId);

  if (active) {
    return active;
  }

  return prisma.workoutSession.create({
    data: {
      userId,
      status: WorkoutSessionStatus.IN_PROGRESS,
    },
    include: {
      workoutDay: true,
      logs: true,
    },
  });
}

export async function startWorkoutSessionForDay(
  userId: string,
  workoutDayId: string,
) {
  const active = await getActiveWorkoutSession(userId);

  if (active) {
    return active;
  }

  return prisma.workoutSession.create({
    data: {
      userId,
      workoutDayId,
      status: WorkoutSessionStatus.IN_PROGRESS,
    },
    include: {
      workoutDay: true,
      logs: true,
    },
  });
}

export async function logWorkoutSet(
  userId: string,
  parsedSet: ParsedWorkoutSet,
  exerciseId?: string | null,
) {
  const session = await getActiveWorkoutSession(userId);

  if (!session || session.status === WorkoutSessionStatus.COMPLETED) {
    throw new Error("NO_ACTIVE_WORKOUT_SESSION");
  }

  const exercise = exerciseId
    ? await prisma.exercise.findUnique({
        where: {
          id: exerciseId,
        },
      })
    : null;
  const exerciseName = exercise?.name ?? parsedSet.exerciseName;
  const nextSetNumber = getNextSetNumber(session.logs, exerciseName, exercise?.id ?? null);

  await prisma.workoutSession.update({
    where: {
      id: session.id,
    },
    data: {
      status: WorkoutSessionStatus.IN_PROGRESS,
    },
  });

  return prisma.exerciseLog.create({
    data: buildExerciseLogCreateData({
      workoutSessionId: session.id,
      exerciseId: exercise?.id ?? null,
      exerciseName,
      setNumber: nextSetNumber,
      weightKg: parsedSet.weightKg,
      reps: parsedSet.reps,
    }),
  });
}

export async function getLatestWorkoutLog(
  userId: string,
): Promise<LatestWorkoutLog | null> {
  return prisma.exerciseLog.findFirst({
    where: {
      workoutSession: {
        userId,
      },
    },
    include: {
      workoutSession: {
        include: {
          workoutDay: true,
        },
      },
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
  });
}

export function selectLatestWorkoutLog<T extends {
  createdAt: Date;
  id: string;
}>(logs: T[]): T | null {
  return (
    [...logs].sort((left, right) => {
      const createdDelta = right.createdAt.getTime() - left.createdAt.getTime();

      if (createdDelta !== 0) {
        return createdDelta;
      }

      return right.id.localeCompare(left.id);
    })[0] ?? null
  );
}

export function buildExerciseLogUpdateData(input: {
  exerciseId?: string | null;
  exerciseName: string;
  weightKg: number | null;
  reps: number;
}): Prisma.ExerciseLogUncheckedUpdateInput {
  return {
    exerciseId: input.exerciseId ?? null,
    exerciseName: input.exerciseName,
    weightKg: input.weightKg,
    reps: input.reps,
  };
}

export async function updateLatestWorkoutLog(input: {
  userId: string;
  exerciseLogId: string;
  exerciseId?: string | null;
  exerciseName: string;
  weightKg: number | null;
  reps: number;
}): Promise<LatestWorkoutLog | null> {
  const latest = await getLatestWorkoutLog(input.userId);

  if (latest?.id !== input.exerciseLogId) {
    return null;
  }

  return prisma.exerciseLog.update({
    where: {
      id: input.exerciseLogId,
    },
    data: buildExerciseLogUpdateData(input),
    include: {
      workoutSession: {
        include: {
          workoutDay: true,
        },
      },
    },
  });
}

export async function deleteLatestWorkoutLog(input: {
  userId: string;
  exerciseLogId: string;
}): Promise<boolean> {
  const latest = await getLatestWorkoutLog(input.userId);

  if (latest?.id !== input.exerciseLogId) {
    return false;
  }

  return prisma.$transaction(async (tx) => {
    const deleteResult = await tx.exerciseLog.deleteMany({
      where: buildLatestWorkoutLogDeleteWhere(input),
    });

    if (deleteResult.count !== 1) {
      return false;
    }

    const remainingLogCount = await tx.exerciseLog.count({
      where: {
        workoutSessionId: latest.workoutSessionId,
      },
    });

    if (
      shouldDeleteEmptyWorkoutSession({
        remainingLogCount,
        status: latest.workoutSession.status,
      })
    ) {
      await tx.workoutSession.deleteMany({
        where: {
          id: latest.workoutSessionId,
          userId: input.userId,
          status: WorkoutSessionStatus.COMPLETED,
        },
      });
    }

    return true;
  });
}

export function buildLatestWorkoutLogDeleteWhere(input: {
  userId: string;
  exerciseLogId: string;
}): Prisma.ExerciseLogWhereInput {
  return {
    id: input.exerciseLogId,
    workoutSession: {
      userId: input.userId,
    },
  };
}

export function shouldDeleteEmptyWorkoutSession(input: {
  remainingLogCount: number;
  status: WorkoutSessionStatusType;
}): boolean {
  return (
    input.remainingLogCount === 0 &&
    input.status === WorkoutSessionStatus.COMPLETED
  );
}

export async function finishActiveWorkoutSession(userId: string) {
  const session = await getActiveWorkoutSession(userId);

  if (!session) {
    return null;
  }

  return prisma.workoutSession.update({
    where: {
      id: session.id,
    },
    data: {
      status: WorkoutSessionStatus.COMPLETED,
      completedAt: new Date(),
    },
    include: {
      workoutDay: true,
      logs: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function getWorkoutsToday(
  userId: string,
  date: Date = new Date(),
  timeZone?: string,
) {
  const { start, end } = await getUserDayRange(userId, date, timeZone);

  return prisma.workoutSession.findMany({
    where: {
      userId,
      startedAt: {
        gte: start,
        lt: end,
      },
    },
    include: {
      workoutDay: true,
      logs: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function getWorkoutDayExercises(workoutDayId: string): Promise<ExerciseChoice[]> {
  const exercises = await prisma.exercise.findMany({
    where: {
      workoutDayId,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  return exercises.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
  }));
}

export function matchExerciseChoice(
  parsedSet: ParsedWorkoutSet,
  exercises: ExerciseChoice[],
):
  | { status: "matched"; exercise: ExerciseChoice }
  | { status: "ambiguous"; options: ExerciseChoice[] }
  | { status: "not_found" } {
  const normalizedInput = parsedSet.normalizedExerciseName;
  const exactMatches = exercises.filter(
    (exercise) => normalizeExerciseName(exercise.name) === normalizedInput,
  );

  if (exactMatches.length === 1 && exactMatches[0]) {
    return { status: "matched", exercise: exactMatches[0] };
  }

  if (exactMatches.length > 1) {
    return { status: "ambiguous", options: exactMatches };
  }

  const containsMatches = exercises.filter((exercise) => {
    const normalizedExercise = normalizeExerciseName(exercise.name);

    return (
      normalizedExercise.length >= 3 &&
      normalizedInput.length >= 3 &&
      (normalizedExercise.includes(normalizedInput) ||
        normalizedInput.includes(normalizedExercise))
    );
  });

  if (containsMatches.length === 1 && containsMatches[0]) {
    return { status: "matched", exercise: containsMatches[0] };
  }

  if (containsMatches.length > 1) {
    return { status: "ambiguous", options: containsMatches };
  }

  return { status: "not_found" };
}

export function buildExerciseLogCreateData(input: {
  workoutSessionId: string;
  exerciseId?: string | null;
  exerciseName: string;
  setNumber: number;
  weightKg: number | null;
  reps: number;
}): Prisma.ExerciseLogCreateInput {
  const data: Prisma.ExerciseLogCreateInput = {
    workoutSession: {
      connect: {
        id: input.workoutSessionId,
      },
    },
    exerciseName: input.exerciseName,
    setNumber: input.setNumber,
    weightKg: input.weightKg,
    reps: input.reps,
  };

  if (input.exerciseId) {
    data.exercise = {
      connect: {
        id: input.exerciseId,
      },
    };
  }

  return data;
}

export function getNextSetNumber(
  logs: Array<{
    exerciseId?: string | null;
    exerciseName: string;
    setNumber: number;
  }>,
  exerciseName: string,
  exerciseId?: string | null,
): number {
  const normalizedName = normalizeExerciseName(exerciseName);
  const matchingLogs = logs.filter((log) =>
    exerciseId
      ? log.exerciseId === exerciseId
      : normalizeExerciseName(log.exerciseName) === normalizedName,
  );
  const maxSetNumber = matchingLogs.reduce(
    (max, log) => Math.max(max, log.setNumber),
    0,
  );

  return maxSetNumber + 1;
}

export function canAcceptWorkoutLog(session: { status: WorkoutSessionStatusType }): boolean {
  return isActiveWorkoutStatus(session.status);
}

export function buildWorkoutSessionSummary(
  session: WorkoutSessionWithLogs,
): WorkoutSessionSummary {
  const exerciseNames = new Set(
    session.logs.map((log) => normalizeExerciseName(log.exerciseName)),
  );

  return {
    title: session.workoutDay?.name ?? null,
    exerciseCount: exerciseNames.size,
    totalSets: session.logs.length,
    latestSets: session.logs.slice(-5).map((log) => ({
      exerciseName: log.exerciseName,
      setNumber: log.setNumber,
      weightKg: log.weightKg === null ? null : Number(log.weightKg),
      reps: log.reps,
    })),
  };
}
