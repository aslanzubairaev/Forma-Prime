import { ConversationStep } from "@prisma/client";
import { InlineKeyboard, type Bot, type Context } from "grammy";

import {
  getConversationState,
  resetConversationState,
  setConversationState,
} from "../conversation/conversation-state.service.js";
import type { ConversationPayload } from "../conversation/conversation-state.types.js";
import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { parseWorkoutSet } from "../workouts/workout-parser.js";
import {
  buildWorkoutSessionSummary,
  finishActiveWorkoutSession,
  getActiveWorkoutSession,
  getActiveWorkoutSplit,
  getWorkoutsToday,
  getWorkoutDayExercises,
  logWorkoutSet,
  matchExerciseChoice,
  startManualWorkoutSession,
  startWorkoutSessionForDay,
} from "../workouts/workout.service.js";
import type { ExerciseChoice, ParsedWorkoutSet, WorkoutSessionWithLogs } from "../workouts/workout.types.js";

const workoutDayPattern = /^workout:day:(.+)$/;
const workoutExercisePattern = /^workout:exercise:(.+)$/;
const manualWorkoutAction = "workout:manual";

export function registerWorkoutLoggingHandlers(bot: Bot): void {
  bot.callbackQuery(workoutDayPattern, handleWorkoutDayChoice);
  bot.callbackQuery(manualWorkoutAction, handleManualWorkoutChoice);
  bot.callbackQuery(workoutExercisePattern, handleWorkoutExerciseChoice);
  bot.on("message:text", handleWorkoutText);
}

export async function startWorkoutFlow(ctx: Context): Promise<void> {
  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  const activeSession = await getActiveWorkoutSession(identity.userId);

  if (activeSession) {
    await ctx.reply(await formatActiveWorkoutReply(identity.language, activeSession));
    return;
  }

  const activeSplit = await getActiveWorkoutSplit(identity.userId);

  if (activeSplit && activeSplit.days.length > 0) {
    await ctx.reply(t(identity.language, "workout.chooseDay"), {
      reply_markup: activeSplit.days.reduce(
        (keyboard, day) =>
          keyboard.text(day.name, `workout:day:${day.id}`).row(),
        new InlineKeyboard(),
      ),
    });
    return;
  }

  await ctx.reply(t(identity.language, "workout.noSplit"), {
    reply_markup: new InlineKeyboard().text(
      t(identity.language, "workout.manualStart.button"),
      manualWorkoutAction,
    ),
  });
}

export async function finishWorkoutFlow(ctx: Context): Promise<void> {
  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  const session = await finishActiveWorkoutSession(identity.userId);

  if (!session) {
    await ctx.reply(t(identity.language, "workout.noActive"));
    return;
  }

  await resetConversationState(identity.userId);
  await ctx.reply(formatFinishedWorkout(identity.language, session));
}

export async function showWorkoutsFlow(ctx: Context): Promise<void> {
  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  const activeSession = await getActiveWorkoutSession(identity.userId);

  if (activeSession) {
    await ctx.reply(await formatActiveWorkoutReply(identity.language, activeSession));
    return;
  }

  const sessions = await getWorkoutsToday(identity.userId);

  if (sessions.length === 0) {
    await ctx.reply(t(identity.language, "workout.noneToday"));
    return;
  }

  await ctx.reply(
    [
      t(identity.language, "workout.todayTitle"),
      ...sessions.map((session) => formatCompactWorkoutSummary(identity.language, session)),
    ].join("\n"),
  );
}

async function handleWorkoutDayChoice(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getWorkoutIdentity(ctx);
  const match = ctx.callbackQuery?.data?.match(workoutDayPattern);

  if (!identity || !match?.[1]) {
    return;
  }

  const session = await startWorkoutSessionForDay(identity.userId, match[1]);
  await resetConversationState(identity.userId);
  await ctx.reply(await formatActiveWorkoutReply(identity.language, session));
}

async function handleManualWorkoutChoice(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  const session = await startManualWorkoutSession(identity.userId);
  await resetConversationState(identity.userId);
  await ctx.reply(await formatActiveWorkoutReply(identity.language, session));
}

async function handleWorkoutExerciseChoice(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getWorkoutIdentity(ctx);
  const state = identity ? await getConversationState(identity.userId) : null;
  const payload = state ? readWorkoutEntryPayload(state.payload) : null;
  const match = ctx.callbackQuery?.data?.match(workoutExercisePattern);

  if (!identity || state?.step !== ConversationStep.WORKOUT_ENTRY || !payload || !match?.[1]) {
    if (identity) {
      await ctx.reply(t(identity.language, "workout.clarificationExpired"));
    }
    return;
  }

  await logWorkoutSet(identity.userId, payload.parsedSet, match[1]);
  await resetConversationState(identity.userId);

  const activeSession = await getActiveWorkoutSession(identity.userId);
  await ctx.reply(
    activeSession
      ? formatSetLogged(identity.language, activeSession)
      : t(identity.language, "workout.setLogged"),
  );
}

async function handleWorkoutText(ctx: Context): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    return;
  }

  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    return;
  }

  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  const activeSession = await getActiveWorkoutSession(identity.userId);
  const parsedSet = parseWorkoutSet(rawText);

  if (!activeSession) {
    if (!parsedSet) {
      return;
    }

    await ctx.reply(t(identity.language, "workout.noActiveWithHint"));
    return;
  }

  if (!parsedSet) {
    await ctx.reply(t(identity.language, "workout.parseFailed"));
    return;
  }

  await logParsedWorkoutSet(ctx, identity.userId, identity.language, activeSession, parsedSet);
}

async function logParsedWorkoutSet(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  activeSession: WorkoutSessionWithLogs,
  parsedSet: ParsedWorkoutSet,
): Promise<void> {
  if (!activeSession.workoutDayId) {
    await logWorkoutSet(userId, parsedSet);

    const updatedSession = await getActiveWorkoutSession(userId);
    await ctx.reply(
      updatedSession
        ? formatSetLogged(language, updatedSession)
        : t(language, "workout.setLogged"),
    );
    return;
  }

  const exercises = await getWorkoutDayExercises(activeSession.workoutDayId);
  const match = matchExerciseChoice(parsedSet, exercises);

  if (match.status === "matched") {
    await logWorkoutSet(userId, parsedSet, match.exercise.id);

    const updatedSession = await getActiveWorkoutSession(userId);
    await ctx.reply(
      updatedSession
        ? formatSetLogged(language, updatedSession)
        : t(language, "workout.setLogged"),
    );
    return;
  }

  if (match.status === "ambiguous") {
    await setConversationState(userId, ConversationStep.WORKOUT_ENTRY, {
      parsedSet,
    } as unknown as ConversationPayload);
    await ctx.reply(t(language, "workout.exerciseAmbiguous", {
      exercise: parsedSet.exerciseName,
    }), {
      reply_markup: exerciseOptionsKeyboard(match.options),
    });
    return;
  }

  await ctx.reply(t(language, "workout.exerciseNotFound", {
    exercise: parsedSet.exerciseName,
  }));
}

function exerciseOptionsKeyboard(options: ExerciseChoice[]): InlineKeyboard {
  return options.slice(0, 5).reduce(
    (keyboard, exercise) =>
      keyboard.text(exercise.name, `workout:exercise:${exercise.id}`).row(),
    new InlineKeyboard(),
  );
}

function formatActiveWorkout(
  language: SupportedLanguage,
  session: WorkoutSessionWithLogs,
): string {
  const summary = buildWorkoutSessionSummary(session);

  return [
    t(language, "workout.active"),
    t(language, "workout.summary.title", { title: getSummaryTitle(language, summary.title) }),
    t(language, "workout.summary.counts", {
      exercises: summary.exerciseCount,
      sets: summary.totalSets,
    }),
    ...summary.latestSets.map((set) => formatSetLine(language, set)),
    t(language, "workout.logHint"),
    t(language, "workout.finishHint"),
  ].join("\n");
}

async function formatActiveWorkoutReply(
  language: SupportedLanguage,
  session: WorkoutSessionWithLogs,
): Promise<string> {
  if (!session.workoutDayId) {
    return formatActiveWorkout(language, session);
  }

  const exercises = await getWorkoutDayExercises(session.workoutDayId);

  if (exercises.length === 0) {
    return formatActiveWorkout(language, session);
  }

  return [
    formatActiveWorkout(language, session),
    t(language, "workout.exercisesTitle"),
    exercises.map((exercise) => exercise.name).join(", "),
  ].join("\n");
}

function formatFinishedWorkout(
  language: SupportedLanguage,
  session: WorkoutSessionWithLogs,
): string {
  const summary = buildWorkoutSessionSummary(session);

  return [
    t(language, "workout.finished"),
    t(language, "workout.summary.title", { title: getSummaryTitle(language, summary.title) }),
    t(language, "workout.summary.counts", {
      exercises: summary.exerciseCount,
      sets: summary.totalSets,
    }),
  ].join("\n");
}

function formatCompactWorkoutSummary(
  language: SupportedLanguage,
  session: WorkoutSessionWithLogs,
): string {
  const summary = buildWorkoutSessionSummary(session);

  return t(language, "workout.compactSummary", {
    title: getSummaryTitle(language, summary.title),
    exercises: summary.exerciseCount,
    sets: summary.totalSets,
  });
}

function formatSetLogged(
  language: SupportedLanguage,
  session: WorkoutSessionWithLogs,
): string {
  const latestSet = session.logs.at(-1);

  if (!latestSet) {
    return t(language, "workout.setLogged");
  }

  return [
    t(language, "workout.setLogged"),
    formatSetLine(language, {
      exerciseName: latestSet.exerciseName,
      setNumber: latestSet.setNumber,
      weightKg: latestSet.weightKg === null ? null : Number(latestSet.weightKg),
      reps: latestSet.reps,
    }),
  ].join("\n");
}

function formatSetLine(
  language: SupportedLanguage,
  set: {
    exerciseName: string;
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
  },
): string {
  if (set.weightKg === null) {
    return t(language, "workout.setLine.bodyweight", {
      exercise: set.exerciseName,
      set: set.setNumber,
      reps: set.reps ?? "-",
    });
  }

  return t(language, "workout.setLine.weighted", {
    exercise: set.exerciseName,
    set: set.setNumber,
    weight: set.weightKg,
    reps: set.reps ?? "-",
  });
}

function getSummaryTitle(
  language: SupportedLanguage,
  title: string | null,
): string {
  return title ?? t(language, "workout.manualTitle");
}

async function getWorkoutIdentity(ctx: Context): Promise<{
  userId: string;
  language: SupportedLanguage;
} | null> {
  if (!ctx.from) {
    await ctx.reply(t("en", "common.missingTelegramUser"));
    return null;
  }

  const user = await upsertTelegramUser(ctx.from);
  const profile = await getProfileByUserId(user.id);
  const language = normalizeLanguage(
    profile?.preferredLanguage ?? user.languageCode,
  );

  return {
    userId: user.id,
    language,
  };
}

function readWorkoutEntryPayload(
  payload: ConversationPayload | null,
): { parsedSet: ParsedWorkoutSet } | null {
  if (!payload || !isRecord(payload.parsedSet)) {
    return null;
  }

  const parsedSet = payload.parsedSet;

  if (
    typeof parsedSet.rawText !== "string" ||
    typeof parsedSet.exerciseName !== "string" ||
    typeof parsedSet.normalizedExerciseName !== "string" ||
    typeof parsedSet.reps !== "number" ||
    !Number.isInteger(parsedSet.reps) ||
    parsedSet.reps <= 0
  ) {
    return null;
  }

  if (
    parsedSet.weightKg !== null &&
    (typeof parsedSet.weightKg !== "number" ||
      !Number.isFinite(parsedSet.weightKg) ||
      parsedSet.weightKg <= 0)
  ) {
    return null;
  }

  return {
    parsedSet: parsedSet as ParsedWorkoutSet,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
