import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ReminderType } from "../src/db/prisma-client.js";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const {
  allWeekdays,
  buildReminderPreferenceData,
  getReminderDeliveryTextKey,
  parseReminderTime,
  selectDueReminderPreferences,
} = await import("../src/reminders/reminder.service.js");
const { runReminderDelivery } = await import(
  "../src/reminders/reminder.runner.js"
);
const { saveReminderTimeInput } = await import("../src/bot/reminders.js");

describe("reminder time parsing", () => {
  it("accepts HH:mm time", () => {
    assert.deepEqual(parseReminderTime("09:30"), {
      status: "valid",
      hour: 9,
      minute: 30,
    });
  });

  it("accepts H:mm time", () => {
    assert.deepEqual(parseReminderTime("9:05"), {
      status: "valid",
      hour: 9,
      minute: 5,
    });
  });

  it("rejects invalid time", () => {
    assert.deepEqual(parseReminderTime("25:00"), { status: "invalid" });
    assert.deepEqual(parseReminderTime("soon"), { status: "invalid" });
  });
});

describe("reminder preference data", () => {
  it("uses all weekdays for daily reminders", () => {
    const data = buildReminderPreferenceData({
      type: ReminderType.FOOD_LOG,
      isEnabled: true,
      hour: 20,
      minute: 15,
    });

    assert.deepEqual(data.daysOfWeek, allWeekdays);
  });

  it("uses selected weekday for weekly check-in reminders", () => {
    const data = buildReminderPreferenceData({
      type: ReminderType.WEEKLY_CHECKIN,
      isEnabled: true,
      hour: 10,
      minute: 0,
      weekday: 1,
    });

    assert.deepEqual(data.daysOfWeek, [1]);
  });
});

describe("reminder due selection", () => {
  it("selects due daily reminders for the current local minute", () => {
    const now = new Date("2026-06-08T18:15:30.000Z");
    const due = selectDueReminderPreferences(
      [
        reminderPreference({
          id: "food",
          type: ReminderType.FOOD_LOG,
          hourLocal: 20,
          minuteLocal: 15,
          daysOfWeek: allWeekdays,
          timezone: "Europe/Paris",
        }),
        reminderPreference({
          id: "workout",
          type: ReminderType.WORKOUT_LOG,
          hourLocal: 20,
          minuteLocal: 30,
          daysOfWeek: allWeekdays,
          timezone: "Europe/Paris",
        }),
      ],
      now,
    );

    assert.deepEqual(due.map((preference) => preference.id), ["food"]);
  });

  it("selects weekly reminders only on the configured weekday", () => {
    const monday = new Date("2026-06-08T08:00:00.000Z");
    const due = selectDueReminderPreferences(
      [
        reminderPreference({
          id: "weekly",
          type: ReminderType.WEEKLY_CHECKIN,
          hourLocal: 10,
          minuteLocal: 0,
          daysOfWeek: [1],
          timezone: "Europe/Paris",
        }),
        reminderPreference({
          id: "sunday",
          type: ReminderType.WEEKLY_CHECKIN,
          hourLocal: 10,
          minuteLocal: 0,
          daysOfWeek: [0],
          timezone: "Europe/Paris",
        }),
      ],
      monday,
    );

    assert.deepEqual(due.map((preference) => preference.id), ["weekly"]);
  });

  it("uses the nested user's timezone when selecting due reminders", () => {
    const now = new Date("2026-06-09T00:15:00.000Z");
    const due = selectDueReminderPreferences(
      [
        reminderPreference({
          id: "new-york",
          type: ReminderType.FOOD_LOG,
          hourLocal: 20,
          minuteLocal: 15,
          daysOfWeek: allWeekdays,
          user: {
            timezone: "America/New_York",
          },
        }),
        reminderPreference({
          id: "paris",
          type: ReminderType.FOOD_LOG,
          hourLocal: 20,
          minuteLocal: 15,
          daysOfWeek: allWeekdays,
          user: {
            timezone: "Europe/Paris",
          },
        }),
      ],
      now,
    );

    assert.deepEqual(due.map((preference) => preference.id), ["new-york"]);
  });

  it("does not select a reminder twice in the same scheduled window", () => {
    const now = new Date("2026-06-08T18:15:30.000Z");
    const due = selectDueReminderPreferences(
      [
        reminderPreference({
          id: "food",
          type: ReminderType.FOOD_LOG,
          hourLocal: 20,
          minuteLocal: 15,
          daysOfWeek: allWeekdays,
          lastSentAt: new Date("2026-06-08T18:15:05.000Z"),
          timezone: "Europe/Paris",
        }),
      ],
      now,
    );

    assert.equal(due.length, 0);
  });

  it("maps reminder types to deterministic delivery text keys", () => {
    assert.equal(
      getReminderDeliveryTextKey(ReminderType.FOOD_LOG),
      "reminders.delivery.food",
    );
    assert.equal(
      getReminderDeliveryTextKey(ReminderType.WORKOUT_LOG),
      "reminders.delivery.workout",
    );
    assert.equal(
      getReminderDeliveryTextKey(ReminderType.WEEKLY_CHECKIN),
      "reminders.delivery.weeklyCheckin",
    );
  });
});

describe("reminder delivery runner", () => {
  it("sends due reminder messages and marks them sent", async () => {
    const sentMessages: Array<{ chatId: string; text: string }> = [];
    const marked: Array<{ id: string; sentAt: Date }> = [];
    const referenceDate = new Date(2026, 5, 8, 20, 15, 0);

    const result = await runReminderDelivery({
      bot: {
        api: {
          sendMessage: async (chatId: string, text: string) => {
            sentMessages.push({ chatId, text });
          },
        },
      } as any,
      referenceDate,
      getDuePreferences: async () => [
        {
          ...reminderPreference({
            id: "food",
            type: ReminderType.FOOD_LOG,
            hourLocal: 20,
            minuteLocal: 15,
            daysOfWeek: allWeekdays,
          }),
          createdAt: referenceDate,
          updatedAt: referenceDate,
          user: {
            id: "user_1",
            telegramId: BigInt(12345),
            languageCode: "en",
            profile: null,
          },
        },
      ] as any,
      markSent: async (id, sentAt) => {
        marked.push({ id, sentAt });
      },
    });

    assert.equal(result.sentCount, 1);
    assert.deepEqual(sentMessages, [
      {
        chatId: "12345",
        text: "Time to log your meals for today.",
      },
    ]);
    assert.deepEqual(marked, [{ id: "food", sentAt: referenceDate }]);
  });
});

describe("reminder telegram time input", () => {
  it("repeats the time prompt after invalid time", async () => {
    const replies: string[] = [];
    let savedCount = 0;

    await saveReminderTimeInput(
      replyContext(replies),
      "user_1",
      "en",
      {
        type: ReminderType.FOOD_LOG,
        isEnabled: true,
      },
      "soon",
      {
        upsertPreference: async () => {
          savedCount += 1;
          return {};
        },
        resetState: async () => {},
      } as any,
    );

    assert.equal(savedCount, 0);
    assert.deepEqual(replies, [
      "Time must use HH:mm format, for example 09:30.",
      "Send reminder time in HH:mm format.",
    ]);
  });

  it("saves valid weekly check-in reminder time", async () => {
    const replies: string[] = [];
    const savedInputs: unknown[] = [];

    await saveReminderTimeInput(
      replyContext(replies),
      "user_1",
      "en",
      {
        type: ReminderType.WEEKLY_CHECKIN,
        isEnabled: true,
        weekday: 1,
      },
      "10:30",
      {
        upsertPreference: async (input) => {
          savedInputs.push(input);
          return {};
        },
        resetState: async () => {},
      } as any,
    );

    assert.deepEqual(savedInputs, [
      {
        userId: "user_1",
        type: ReminderType.WEEKLY_CHECKIN,
        isEnabled: true,
        hour: 10,
        minute: 30,
        weekday: 1,
      },
    ]);
    assert.deepEqual(replies, ["Reminder saved."]);
  });
});

function reminderPreference(overrides: {
  id: string;
  type: ReminderType;
  hourLocal: number;
  minuteLocal: number;
  daysOfWeek: number[];
  lastSentAt?: Date | null;
  timezone?: string | null;
  user?: {
    timezone?: string | null;
  };
}) {
  return {
    userId: "user_1",
    isEnabled: true,
    lastSentAt: null,
    ...overrides,
  };
}

function replyContext(replies: string[]) {
  return {
    reply: async (message: string) => {
      replies.push(message);
    },
  } as any;
}
