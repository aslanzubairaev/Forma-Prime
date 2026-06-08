import { prisma } from "../db/prisma.js";

export const defaultTimeZone = "Europe/Paris";

const minuteMs = 60 * 1000;
const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type LocalDateParts = Pick<ZonedDateParts, "year" | "month" | "day">;

export async function getUserTimeZone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      timezone: true,
    },
  });

  return resolveTimeZone(user?.timezone);
}

export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone || !isValidTimeZone(timeZone)) {
    return defaultTimeZone;
  }

  return timeZone;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function getZonedDayRange(
  referenceDate: Date,
  timeZone: string | null | undefined,
): { start: Date; end: Date } {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const localDate = getZonedDateParts(referenceDate, resolvedTimeZone);

  return {
    start: zonedDateTimeToUtc(
      { ...localDate, hour: 0, minute: 0, second: 0 },
      resolvedTimeZone,
    ),
    end: zonedDateTimeToUtc(
      { ...addCalendarDays(localDate, 1), hour: 0, minute: 0, second: 0 },
      resolvedTimeZone,
    ),
  };
}

export function getZonedRecentWeekRange(
  referenceDate: Date,
  timeZone: string | null | undefined,
): { start: Date; end: Date } {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const localDate = getZonedDateParts(referenceDate, resolvedTimeZone);

  return {
    start: zonedDateTimeToUtc(
      { ...addCalendarDays(localDate, -6), hour: 0, minute: 0, second: 0 },
      resolvedTimeZone,
    ),
    end: zonedDateTimeToUtc(
      { ...addCalendarDays(localDate, 1), hour: 0, minute: 0, second: 0 },
      resolvedTimeZone,
    ),
  };
}

export function getZonedWeekStartDate(
  referenceDate: Date,
  timeZone: string | null | undefined,
): Date {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const localDate = getZonedDateParts(referenceDate, resolvedTimeZone);
  const day = getWeekday(localDate);
  const mondayOffset = day === 0 ? -6 : 1 - day;

  return zonedDateTimeToUtc(
    { ...addCalendarDays(localDate, mondayOffset), hour: 0, minute: 0, second: 0 },
    resolvedTimeZone,
  );
}

export function getZonedClock(
  referenceDate: Date,
  timeZone: string | null | undefined,
): { weekday: number; hour: number; minute: number } {
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const parts = getZonedDateParts(referenceDate, resolvedTimeZone);

  return {
    weekday: getWeekday(parts),
    hour: parts.hour,
    minute: parts.minute,
  };
}

export function getZonedScheduledMinuteWindow(input: {
  referenceDate: Date;
  timeZone: string | null | undefined;
  hour: number;
  minute: number;
}): { start: Date; end: Date } {
  const resolvedTimeZone = resolveTimeZone(input.timeZone);
  const localDate = getZonedDateParts(input.referenceDate, resolvedTimeZone);
  const start = zonedDateTimeToUtc(
    {
      ...localDate,
      hour: input.hour,
      minute: input.minute,
      second: 0,
    },
    resolvedTimeZone,
  );

  return {
    start,
    end: new Date(start.getTime() + minuteMs),
  };
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = getDateTimeFormat(timeZone);
  const parts = formatter.formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    year: readPart(values, "year"),
    month: readPart(values, "month"),
    day: readPart(values, "day"),
    hour: readPart(values, "hour"),
    minute: readPart(values, "minute"),
    second: readPart(values, "second"),
  };
}

function zonedDateTimeToUtc(parts: ZonedDateParts, timeZone: string): Date {
  const localUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0,
  );
  const firstGuess = localUtc - getTimeZoneOffsetMs(new Date(localUtc), timeZone);
  const secondGuess =
    localUtc - getTimeZoneOffsetMs(new Date(firstGuess), timeZone);

  return new Date(secondGuess);
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedDateParts(date, timeZone);
  const localUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds(),
  );

  return localUtc - date.getTime();
}

function addCalendarDays(parts: LocalDateParts, days: number): LocalDateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getWeekday(parts: LocalDateParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function getDateTimeFormat(timeZone: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  dateTimeFormatCache.set(timeZone, formatter);

  return formatter;
}

function readPart(parts: Map<string, string>, key: string): number {
  const value = parts.get(key);

  if (!value) {
    throw new Error(`Missing ${key} in timezone conversion`);
  }

  return Number(value);
}
