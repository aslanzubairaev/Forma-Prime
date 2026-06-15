import { InlineKeyboard, type Bot, type Context, type NextFunction } from "grammy";

import {
  claimConversationStep,
  getConversationState,
  resetConversationState,
  setConversationState,
} from "../conversation/conversation-state.service.js";
import type { ConversationPayload } from "../conversation/conversation-state.types.js";
import { ConversationStep } from "../db/prisma-client.js";
import { normalizeLanguage, t, type SupportedLanguage } from "../i18n/index.js";
import { getProfileByUserId } from "../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../users/user.service.js";
import { parseWorkoutSet } from "../workouts/workout-parser.js";
import {
  buildWorkoutSessionSummary,
  deleteLatestWorkoutLog,
  finishActiveWorkoutSession,
  getActiveWorkoutSession,
  getActiveWorkoutSplit,
  getLatestWorkoutLog,
  getWorkoutsToday,
  getWorkoutDayExercises,
  logWorkoutSet,
  matchExerciseChoice,
  startManualWorkoutSession,
  startWorkoutSessionForDay,
  updateLatestWorkoutLog,
  type LatestWorkoutLog,
} from "../workouts/workout.service.js";
import type { ExerciseChoice, ParsedWorkoutSet, WorkoutSessionWithLogs } from "../workouts/workout.types.js";

const workoutDayPattern = /^workout:day:(.+)$/;
const workoutExercisePattern = /^workout:exercise:(.+)$/;
const workoutEditExercisePattern = /^workoutedit:exercise:(.+)$/;
const lastWorkoutEditPattern = /^lastworkout:edit:(.+)$/;
const lastWorkoutDeletePattern = /^lastworkout:delete:(.+)$/;
const lastWorkoutConfirmDeletePattern = /^lastworkout:confirm_delete:(.+)$/;
const lastWorkoutCancelAction = "lastworkout:cancel";
const manualWorkoutAction = "workout:manual";

export function registerWorkoutLoggingHandlers(bot: Bot): void {
  bot.command("lastworkout", handleLastWorkoutCommand);
  bot.callbackQuery(workoutDayPattern, handleWorkoutDayChoice);
  bot.callbackQuery(manualWorkoutAction, handleManualWorkoutChoice);
  bot.callbackQuery(workoutExercisePattern, handleWorkoutExerciseChoice);
  bot.callbackQuery(workoutEditExercisePattern, handleWorkoutEditExerciseChoice);
  bot.callbackQuery(lastWorkoutEditPattern, handleLastWorkoutEditCallback);
  bot.callbackQuery(lastWorkoutDeletePattern, handleLastWorkoutDeleteCallback);
  bot.callbackQuery(lastWorkoutConfirmDeletePattern, handleLastWorkoutConfirmDeleteCallback);
  bot.callbackQuery(lastWorkoutCancelAction, handleLastWorkoutCancelCallback);
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

async function handleLastWorkoutCommand(ctx: Context): Promise<void> {
  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  const log = await getLatestWorkoutLog(identity.userId);

  if (!log) {
    await ctx.reply(t(identity.language, "lastWorkout.empty"));
    return;
  }

  await ctx.reply(formatLatestWorkout(identity.language, log), {
    reply_markup: lastWorkoutKeyboard(identity.language, log.id),
  });
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

async function handleWorkoutEditExerciseChoice(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const identity = await getWorkoutIdentity(ctx);
  const state = identity ? await getConversationState(identity.userId) : null;
  const payload = state ? readWorkoutEditExercisePayload(state.payload) : null;
  const match = ctx.callbackQuery?.data?.match(workoutEditExercisePattern);

  if (!identity || state?.step !== ConversationStep.WORKOUT_EDIT_EXERCISE || !payload || !match?.[1]) {
    if (identity) {
      await ctx.reply(t(identity.language, "lastWorkout.expired"));
    }
    return;
  }

  const exercises = await getWorkoutDayExercises(payload.workoutDayId);
  const exercise = exercises.find((candidate) => candidate.id === match[1]);

  if (!exercise) {
    await ctx.reply(t(identity.language, "lastWorkout.expired"));
    return;
  }

  const claimed = await claimConversationStep(
    identity.userId,
    ConversationStep.WORKOUT_EDIT_EXERCISE,
  );

  if (!claimed) {
    await ctx.reply(t(identity.language, "lastWorkout.expired"));
    return;
  }

  const updated = await updateLatestWorkoutLog({
    userId: identity.userId,
    exerciseLogId: payload.exerciseLogId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    weightKg: payload.parsedSet.weightKg,
    reps: payload.parsedSet.reps,
  });

  await ctx.reply(
    updated
      ? t(identity.language, "lastWorkout.updated")
      : t(identity.language, "lastWorkout.expired"),
  );
}

async function handleLastWorkoutEditCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getWorkoutIdentity(ctx);
  const exerciseLogId = ctx.callbackQuery?.data?.match(lastWorkoutEditPattern)?.[1];

  if (!identity || !exerciseLogId) {
    return;
  }

  await setConversationState(identity.userId, ConversationStep.WORKOUT_EDIT, {
    exerciseLogId,
  });
  await ctx.reply(t(identity.language, "lastWorkout.editPrompt"));
}

async function handleLastWorkoutDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getWorkoutIdentity(ctx);
  const exerciseLogId = ctx.callbackQuery?.data?.match(lastWorkoutDeletePattern)?.[1];

  if (!identity || !exerciseLogId) {
    return;
  }

  await setConversationState(identity.userId, ConversationStep.WORKOUT_DELETE, {
    exerciseLogId,
  });
  await ctx.reply(t(identity.language, "lastWorkout.deleteConfirm"), {
    reply_markup: lastWorkoutDeleteConfirmKeyboard(identity.language, exerciseLogId),
  });
}

async function handleLastWorkoutConfirmDeleteCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getWorkoutIdentity(ctx);
  const exerciseLogId = ctx.callbackQuery?.data?.match(lastWorkoutConfirmDeletePattern)?.[1];

  if (!identity || !exerciseLogId) {
    return;
  }

  const state = await getConversationState(identity.userId);
  const payload = readLatestWorkoutPayload(state.payload);

  if (state.step !== ConversationStep.WORKOUT_DELETE || payload?.exerciseLogId !== exerciseLogId) {
    await ctx.reply(t(identity.language, "lastWorkout.expired"));
    return;
  }

  const claimed = await claimConversationStep(identity.userId, ConversationStep.WORKOUT_DELETE);

  if (!claimed) {
    await ctx.reply(t(identity.language, "lastWorkout.expired"));
    return;
  }

  const deleted = await deleteLatestWorkoutLog({
    userId: identity.userId,
    exerciseLogId,
  });

  await ctx.reply(
    deleted
      ? t(identity.language, "lastWorkout.deleted")
      : t(identity.language, "lastWorkout.expired"),
  );
}

async function handleLastWorkoutCancelCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  await resetConversationState(identity.userId);
  await ctx.reply(t(identity.language, "lastWorkout.cancelled"));
}

async function handleWorkoutText(
  ctx: Context,
  next: NextFunction,
): Promise<void> {
  if (!ctx.from || !ctx.message?.text) {
    await next();
    return;
  }

  const rawText = ctx.message.text.trim();

  if (rawText.startsWith("/")) {
    await next();
    return;
  }

  const identity = await getWorkoutIdentity(ctx);

  if (!identity) {
    return;
  }

  const state = await getConversationState(identity.userId);

  if (state.step === ConversationStep.WORKOUT_EDIT) {
    await handleWorkoutEditText(ctx, identity.userId, identity.language, rawText, state.payload);
    return;
  }

  if (state.step === ConversationStep.WORKOUT_EDIT_EXERCISE) {
    await ctx.reply(t(identity.language, "common.useCurrentQuestion"));
    return;
  }

  if (state.step !== ConversationStep.IDLE && state.step !== ConversationStep.WORKOUT_ENTRY) {
    await next();
    return;
  }

  const activeSession = await getActiveWorkoutSession(identity.userId);
  const parsedSet = parseWorkoutSet(rawText);

  if (!activeSession) {
    if (!parsedSet) {
      await next();
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

async function handleWorkoutEditText(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  rawText: string,
  payload: ConversationPayload | null,
): Promise<void> {
  const editPayload = readLatestWorkoutPayload(payload);

  if (!editPayload) {
    await resetConversationState(userId);
    await ctx.reply(t(language, "lastWorkout.expired"));
    return;
  }

  const parsedSet = parseWorkoutSet(rawText);

  if (!parsedSet) {
    await ctx.reply(t(language, "lastWorkout.editInvalid"));
    return;
  }

  const latestLog = await getLatestWorkoutLog(userId);

  if (!latestLog || latestLog.id !== editPayload.exerciseLogId) {
    await resetConversationState(userId);
    await ctx.reply(t(language, "lastWorkout.expired"));
    return;
  }

  if (!latestLog.workoutSession.workoutDayId) {
    await updateWorkoutEditAfterClaim(ctx, userId, language, {
      exerciseLogId: editPayload.exerciseLogId,
      exerciseId: null,
      exerciseName: parsedSet.exerciseName,
      weightKg: parsedSet.weightKg,
      reps: parsedSet.reps,
    });
    return;
  }

  const exercises = await getWorkoutDayExercises(latestLog.workoutSession.workoutDayId);
  const match = matchExerciseChoice(parsedSet, exercises);

  if (match.status === "matched") {
    await updateWorkoutEditAfterClaim(ctx, userId, language, {
      exerciseLogId: editPayload.exerciseLogId,
      exerciseId: match.exercise.id,
      exerciseName: match.exercise.name,
      weightKg: parsedSet.weightKg,
      reps: parsedSet.reps,
    });
    return;
  }

  if (match.status === "ambiguous") {
    await setConversationState(userId, ConversationStep.WORKOUT_EDIT_EXERCISE, {
      exerciseLogId: editPayload.exerciseLogId,
      workoutDayId: latestLog.workoutSession.workoutDayId,
      parsedSet,
    } as unknown as ConversationPayload);
    await ctx.reply(t(language, "lastWorkout.exerciseAmbiguous", {
      exercise: parsedSet.exerciseName,
    }), {
      reply_markup: workoutEditExerciseKeyboard(match.options),
    });
    return;
  }

  await ctx.reply(t(language, "lastWorkout.exerciseNotFound", {
    exercise: parsedSet.exerciseName,
  }));
}

async function updateWorkoutEditAfterClaim(
  ctx: Context,
  userId: string,
  language: SupportedLanguage,
  input: {
    exerciseLogId: string;
    exerciseId: string | null;
    exerciseName: string;
    weightKg: number | null;
    reps: number;
  },
): Promise<void> {
  const claimed = await claimConversationStep(userId, ConversationStep.WORKOUT_EDIT);

  if (!claimed) {
    await ctx.reply(t(language, "lastWorkout.expired"));
    return;
  }

  const updated = await updateLatestWorkoutLog({
    userId,
    ...input,
  });

  await ctx.reply(
    updated
      ? t(language, "lastWorkout.updated")
      : t(language, "lastWorkout.expired"),
  );
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

function workoutEditExerciseKeyboard(options: ExerciseChoice[]): InlineKeyboard {
  return options.slice(0, 5).reduce(
    (keyboard, exercise) =>
      keyboard.text(exercise.name, `workoutedit:exercise:${exercise.id}`).row(),
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

export function formatLatestWorkout(
  language: SupportedLanguage,
  log: LatestWorkoutLog,
): string {
  return [
    t(language, "lastWorkout.title"),
    t(language, "lastWorkout.summary", {
      exercise: log.exerciseName,
      weight: log.weightKg === null ? "-" : Number(log.weightKg),
      reps: log.reps ?? "-",
      timestamp: log.createdAt.toISOString(),
    }),
  ].join("\n");
}

function lastWorkoutKeyboard(
  language: SupportedLanguage,
  exerciseLogId: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "lastLog.button.edit"), `lastworkout:edit:${exerciseLogId}`)
    .text(t(language, "lastLog.button.delete"), `lastworkout:delete:${exerciseLogId}`)
    .row()
    .text(t(language, "lastLog.button.cancel"), lastWorkoutCancelAction);
}

function lastWorkoutDeleteConfirmKeyboard(
  language: SupportedLanguage,
  exerciseLogId: string,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      t(language, "lastLog.button.confirmDelete"),
      `lastworkout:confirm_delete:${exerciseLogId}`,
    )
    .row()
    .text(t(language, "lastLog.button.cancel"), lastWorkoutCancelAction);
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

function readLatestWorkoutPayload(
  payload: ConversationPayload | null,
): { exerciseLogId: string } | null {
  if (!payload || typeof payload.exerciseLogId !== "string") {
    return null;
  }

  return {
    exerciseLogId: payload.exerciseLogId,
  };
}

function readWorkoutEditExercisePayload(
  payload: ConversationPayload | null,
): {
  exerciseLogId: string;
  workoutDayId: string;
  parsedSet: ParsedWorkoutSet;
} | null {
  if (
    !payload ||
    typeof payload.exerciseLogId !== "string" ||
    typeof payload.workoutDayId !== "string"
  ) {
    return null;
  }

  const parsedPayload = readWorkoutEntryPayload(payload);

  if (!parsedPayload) {
    return null;
  }

  return {
    exerciseLogId: payload.exerciseLogId,
    workoutDayId: payload.workoutDayId,
    parsedSet: parsedPayload.parsedSet,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
