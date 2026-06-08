import type { ReminderType } from "@prisma/client";

export type ReminderTimeParseResult =
  | {
      status: "valid";
      hour: number;
      minute: number;
    }
  | {
      status: "invalid";
    };

export type ReminderPreferenceData = {
  type: ReminderType;
  isEnabled: boolean;
  hourLocal: number;
  minuteLocal: number;
  daysOfWeek: number[];
};

export type ReminderPreferenceDueInput = ReminderPreferenceData & {
  id: string;
  userId: string;
  lastSentAt: Date | null;
};

export type ReminderSetupPayload = {
  type?: ReminderType;
  isEnabled?: boolean;
  weekday?: number;
};
