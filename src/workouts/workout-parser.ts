import type { ParsedWorkoutSet } from "./workout.types.js";

const weightedSetPattern = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:kg|кг)?\s*x\s*(\d+)$/iu;
const bodyweightSetPattern = /^(.+?)\s+x\s*(\d+)$/iu;

export function parseWorkoutSet(input: string): ParsedWorkoutSet | null {
  const text = input.trim();

  if (!text || text.startsWith("/")) {
    return null;
  }

  const weightedMatch = text.match(weightedSetPattern);

  if (weightedMatch) {
    return buildParsedSet(text, weightedMatch[1], weightedMatch[2], weightedMatch[3]);
  }

  const bodyweightMatch = text.match(bodyweightSetPattern);

  if (bodyweightMatch) {
    return buildParsedSet(text, bodyweightMatch[1], null, bodyweightMatch[2]);
  }

  return null;
}

export function normalizeExerciseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildParsedSet(
  rawText: string,
  rawExerciseName: string | undefined,
  rawWeight: string | null | undefined,
  rawReps: string | undefined,
): ParsedWorkoutSet | null {
  if (!rawExerciseName || !rawReps) {
    return null;
  }

  const exerciseName = rawExerciseName.trim();
  const normalizedExerciseName = normalizeExerciseName(exerciseName);
  const weightKg = rawWeight ? Number(rawWeight.replace(",", ".")) : null;
  const reps = Number(rawReps);

  if (!exerciseName || !normalizedExerciseName || !Number.isInteger(reps) || reps <= 0) {
    return null;
  }

  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0)) {
    return null;
  }

  return {
    rawText,
    exerciseName,
    normalizedExerciseName,
    weightKg,
    reps,
  };
}
