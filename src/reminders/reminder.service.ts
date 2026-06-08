import { ReminderType, type Prisma } from "@prisma/client";

import { prisma } from "../db/prisma.js";
import type {
  ReminderPreferenceData,
  ReminderPreferenceDueInput,
  ReminderTimeParseResult,
} from "./reminder.types.js";

export const allWeekdays = [0, 1, 2, 3, 4, 5, 6];

const minuteMs = 60 * 1000;

const defaultReminderConfig: Record<
  ReminderType,
  {
    hour: number;
    minute: number;
    daysOfWeek: number[];
  }
> = {
  [ReminderType.FOOD_LOG]: {
    hour: 20,
    minute: 0,
    daysOfWeek: allWeekdays,
  },
  [ReminderType.WORKOUT_LOG]: {
    hour: 19,
    minute: 0,
    daysOfWeek: allWeekdays,
  },
  [ReminderType.WEEKLY_CHECKIN]: {
    hour: 10,
    minute: 0,
    daysOfWeek: [0],
  },
};

export function parseReminderTime(rawValue: string): ReminderTimeParseResult {
  const match = rawValue.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match?.[1] || !match[2]) {
    return {
      status: "invalid",
    };
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return {
      status: "invalid",
    };
  }

  return {
    status: "valid",
    hour,
    minute,
  };
}

export function buildReminderPreferenceData(input: {
  type: ReminderType;
  isEnabled: boolean;
  hour: number;
  minute: number;
  weekday?: number;
}): ReminderPreferenceData {
  return {
    type: input.type,
    isEnabled: input.isEnabled,
    hourLocal: input.hour,
    minuteLocal: input.minute,
    daysOfWeek:
      input.type === ReminderType.WEEKLY_CHECKIN
        ? [input.weekday ?? defaultReminderConfig[input.type].daysOfWeek[0]!]
        : allWeekdays,
  };
}

export async function getReminderPreferences(userId: string) {
  return prisma.reminderPreference.findMany({
    where: {
      userId,
    },
    orderBy: {
      type: "asc",
    },
  });
}

export async function upsertReminderPreference(input: {
  userId: string;
  type: ReminderType;
  isEnabled: boolean;
  hour: number;
  minute: number;
  weekday?: number;
}) {
  const data = buildReminderPreferenceData(input);

  return prisma.reminderPreference.upsert({
    where: {
      userId_type: {
        userId: input.userId,
        type: input.type,
      },
    },
    create: {
      userId: input.userId,
      ...data,
    },
    update: {
      isEnabled: data.isEnabled,
      hourLocal: data.hourLocal,
      minuteLocal: data.minuteLocal,
      daysOfWeek: data.daysOfWeek,
    },
  });
}

export async function disableReminderPreference(input: {
  userId: string;
  type: ReminderType;
}) {
  const defaults = defaultReminderConfig[input.type];

  return prisma.reminderPreference.upsert({
    where: {
      userId_type: {
        userId: input.userId,
        type: input.type,
      },
    },
    create: {
      userId: input.userId,
      type: input.type,
      isEnabled: false,
      hourLocal: defaults.hour,
      minuteLocal: defaults.minute,
      daysOfWeek: defaults.daysOfWeek,
    },
    update: {
      isEnabled: false,
    },
  });
}

export type DueReminderPreference = Prisma.ReminderPreferenceGetPayload<{
  include: {
    user: {
      include: {
        profile: true;
      };
    };
  };
}>;

export async function getDueReminderPreferences(
  referenceDate: Date = new Date(),
): Promise<DueReminderPreference[]> {
  const candidates = await prisma.reminderPreference.findMany({
    where: {
      isEnabled: true,
      hourLocal: referenceDate.getHours(),
      minuteLocal: referenceDate.getMinutes(),
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  return selectDueReminderPreferences(candidates, referenceDate);
}

export function selectDueReminderPreferences<
  TPreference extends ReminderPreferenceDueInput,
>(preferences: TPreference[], referenceDate: Date): TPreference[] {
  return preferences.filter((preference) =>
    isReminderDue(preference, referenceDate),
  );
}

export async function markReminderSent(
  reminderPreferenceId: string,
  sentAt: Date = new Date(),
): Promise<void> {
  await prisma.reminderPreference.update({
    where: {
      id: reminderPreferenceId,
    },
    data: {
      lastSentAt: sentAt,
    },
  });
}

export function getReminderDeliveryTextKey(
  type: ReminderType,
):
  | "reminders.delivery.food"
  | "reminders.delivery.workout"
  | "reminders.delivery.weeklyCheckin" {
  if (type === ReminderType.FOOD_LOG) {
    return "reminders.delivery.food";
  }

  if (type === ReminderType.WORKOUT_LOG) {
    return "reminders.delivery.workout";
  }

  return "reminders.delivery.weeklyCheckin";
}

function isReminderDue(
  preference: ReminderPreferenceDueInput,
  referenceDate: Date,
): boolean {
  if (!preference.isEnabled) {
    return false;
  }

  if (
    preference.hourLocal !== referenceDate.getHours() ||
    preference.minuteLocal !== referenceDate.getMinutes()
  ) {
    return false;
  }

  if (!isReminderDayAllowed(preference, referenceDate)) {
    return false;
  }

  return !wasReminderSentInCurrentWindow(preference, referenceDate);
}

function isReminderDayAllowed(
  preference: ReminderPreferenceDueInput,
  referenceDate: Date,
): boolean {
  if (preference.daysOfWeek.length === 0) {
    return preference.type !== ReminderType.WEEKLY_CHECKIN;
  }

  return preference.daysOfWeek.includes(referenceDate.getDay());
}

function wasReminderSentInCurrentWindow(
  preference: ReminderPreferenceDueInput,
  referenceDate: Date,
): boolean {
  if (!preference.lastSentAt) {
    return false;
  }

  const windowStart = new Date(referenceDate);
  windowStart.setHours(preference.hourLocal, preference.minuteLocal, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + minuteMs);
  const lastSentAt = preference.lastSentAt.getTime();

  return (
    lastSentAt >= windowStart.getTime() && lastSentAt < windowEnd.getTime()
  );
}
