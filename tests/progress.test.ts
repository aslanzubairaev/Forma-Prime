import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BodyweightCheckinSource,
  CheckinStatusLabel,
  ConversationStep,
} from "@prisma/client";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const {
  buildBodyweightCheckinCreateData,
  buildProgressSummary,
  buildWeeklySummary,
  buildWeeklyCheckinCreateData,
  buildWeeklyCheckinSummary,
  formatWeeklySummary,
  getWeeklyStatusLabel,
  getRecentWeekRange,
  parseRating,
  parseWeightKg,
} = await import("../src/progress/progress.service.js");
const { finishCheckin, saveManualWeight } = await import("../src/bot/progress.js");

describe("weight parsing", () => {
  it("accepts integer weight", () => {
    assert.deepEqual(parseWeightKg("78"), { status: "valid", value: 78 });
  });

  it("accepts dot decimal weight", () => {
    assert.deepEqual(parseWeightKg("78.4"), { status: "valid", value: 78.4 });
  });

  it("accepts comma decimal weight", () => {
    assert.deepEqual(parseWeightKg("78,4"), { status: "valid", value: 78.4 });
  });

  it("rejects text", () => {
    assert.deepEqual(parseWeightKg("seventy eight"), { status: "invalid" });
  });

  it("rejects out-of-range values", () => {
    assert.deepEqual(parseWeightKg("301"), { status: "out_of_range" });
  });
});

describe("progress summary logic", () => {
  it("returns empty summary for no records", () => {
    const summary = buildProgressSummary([]);

    assert.equal(summary.status, "empty");
  });

  it("returns latest only for one record", () => {
    const summary = buildProgressSummary([
      weightRecord("latest", 78.4, "2026-06-07T08:00:00.000Z"),
    ]);

    assert.equal(summary.status, "partial");
    assert.equal(summary.latest.weightKg, 78.4);
    assert.equal(summary.previous, null);
    assert.equal(summary.weekDelta, null);
  });

  it("returns delta against previous record", () => {
    const summary = buildProgressSummary([
      weightRecord("older", 79.2, "2026-06-05T08:00:00.000Z"),
      weightRecord("latest", 78.4, "2026-06-07T08:00:00.000Z"),
    ]);

    assert.equal(summary.status, "complete");
    assert.equal(summary.previous?.weightKg, 79.2);
    assert.equal(summary.previousDelta, -0.8);
    assert.equal(summary.weekDelta, null);
  });

  it("returns week delta when baseline is available", () => {
    const summary = buildProgressSummary([
      weightRecord("week", 80.1, "2026-05-31T08:00:00.000Z"),
      weightRecord("previous", 79.2, "2026-06-05T08:00:00.000Z"),
      weightRecord("latest", 78.4, "2026-06-07T08:00:00.000Z"),
    ]);

    assert.equal(summary.weekBaseline?.id, "week");
    assert.equal(summary.weekDelta, -1.7);
  });

  it("uses closest earlier record at least seven days before latest", () => {
    const summary = buildProgressSummary([
      weightRecord("too-recent", 79.7, "2026-06-01T08:00:00.000Z"),
      weightRecord("older", 80.5, "2026-05-29T08:00:00.000Z"),
      weightRecord("closest", 80.1, "2026-05-31T07:59:59.000Z"),
      weightRecord("latest", 78.4, "2026-06-07T08:00:00.000Z"),
    ]);

    assert.equal(summary.weekBaseline?.id, "closest");
    assert.equal(summary.weekDelta, -1.7);
  });
});

describe("weekly check-in logic", () => {
  it("parses valid rating", () => {
    assert.equal(parseRating("5"), 5);
  });

  it("rejects invalid rating", () => {
    assert.equal(parseRating("6"), null);
  });

  it("builds bodyweight create data with source", () => {
    const data = buildBodyweightCheckinCreateData({
      userId: "user_1",
      weightKg: 78.4,
      source: BodyweightCheckinSource.WEEKLY_CHECKIN,
      recordedAt: new Date("2026-06-07T08:00:00.000Z"),
      notes: "felt good",
    }) as any;

    assert.equal(data.user.connect.id, "user_1");
    assert.equal(data.weightKg, 78.4);
    assert.equal(data.source, BodyweightCheckinSource.WEEKLY_CHECKIN);
    assert.equal(data.checkedAt.toISOString(), "2026-06-07T08:00:00.000Z");
    assert.equal(data.notes, "felt good");
  });

  it("builds weekly check-in create data", () => {
    const data = buildWeeklyCheckinCreateData({
      userId: "user_1",
      weekStartDate: new Date("2026-06-01T00:00:00.000Z"),
      weightKg: 78.4,
      nutritionAdherence: 4,
      trainingAdherence: 3,
      energy: 5,
      notes: null,
      statusLabel: CheckinStatusLabel.ON_TRACK,
    }) as any;

    assert.equal(data.user.connect.id, "user_1");
    assert.equal(data.weightKg, 78.4);
    assert.equal(data.nutritionAdherence, 4);
    assert.equal(data.trainingAdherence, 3);
    assert.equal(data.energy, 5);
    assert.equal(data.statusLabel, CheckinStatusLabel.ON_TRACK);
  });

  it("computes the recent seven-day range", () => {
    const range = getRecentWeekRange(new Date("2026-06-07T12:00:00.000Z"));

    assert.equal(range.start.toISOString(), "2026-05-31T12:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-06-07T12:00:00.000Z");
  });

  it("marks no recent logging as insufficient data", () => {
    assert.equal(
      getWeeklyStatusLabel({ mealCount: 0, workoutCount: 0 }),
      CheckinStatusLabel.INSUFFICIENT_DATA,
    );
  });

  it("marks partial recent logging as needs consistency", () => {
    assert.equal(
      getWeeklyStatusLabel({ mealCount: 3, workoutCount: 0 }),
      CheckinStatusLabel.NEEDS_CONSISTENCY,
    );
  });

  it("marks meal and workout activity as on track", () => {
    assert.equal(
      getWeeklyStatusLabel({ mealCount: 3, workoutCount: 1 }),
      CheckinStatusLabel.ON_TRACK,
    );
  });

  it("formats deterministic weekly summary with counts and status", () => {
    const text = buildWeeklyCheckinSummary("en", {
      weightKg: 78.4,
      previousWeightKg: 79.2,
      mealCount: 8,
      workoutCount: 2,
      statusLabel: CheckinStatusLabel.ON_TRACK,
    });

    assert.match(text, /Check-in saved/);
    assert.match(text, /Weight: 78.4 kg/);
    assert.match(text, /Weight change: -0.8 kg/);
    assert.match(text, /Meals this week: 8/);
    assert.match(text, /Workouts this week: 2/);
    assert.match(text, /Status: On track/);
  });
});

describe("weekly summary logic", () => {
  it("marks an empty week without weight as insufficient data", () => {
    const summary = buildWeeklySummary({
      mealCount: 0,
      workoutCount: 0,
      progressSummary: buildProgressSummary([]),
    });

    assert.equal(summary.statusLabel, "insufficient_data");
    assert.equal(summary.latestWeightKg, null);
    assert.equal(summary.weightDeltaKg, null);
  });

  it("keeps latest weight when weight comparison is unavailable", () => {
    const summary = buildWeeklySummary({
      mealCount: 0,
      workoutCount: 0,
      progressSummary: buildProgressSummary([
        weightRecord("latest", 78.4, "2026-06-07T08:00:00.000Z"),
      ]),
    });

    assert.equal(summary.statusLabel, "insufficient_data");
    assert.equal(summary.latestWeightKg, 78.4);
    assert.equal(summary.previousWeightKg, null);
    assert.equal(summary.weightDeltaKg, null);
  });

  it("marks partial weekly logging as needs more consistency", () => {
    const summary = buildWeeklySummary({
      mealCount: 4,
      workoutCount: 0,
      progressSummary: buildProgressSummary([]),
    });

    assert.equal(summary.statusLabel, "needs_more_consistency");
  });

  it("marks normal populated week as on track", () => {
    const summary = buildWeeklySummary({
      mealCount: 8,
      workoutCount: 2,
      progressSummary: buildProgressSummary([
        weightRecord("previous", 79.2, "2026-06-05T08:00:00.000Z"),
        weightRecord("latest", 78.4, "2026-06-07T08:00:00.000Z"),
      ]),
    });

    assert.equal(summary.statusLabel, "on_track");
    assert.equal(summary.latestWeightKg, 78.4);
    assert.equal(summary.previousWeightKg, 79.2);
    assert.equal(summary.weightDeltaKg, -0.8);
  });

  it("formats the weekly summary with localized facts only", () => {
    const text = formatWeeklySummary(
      "en",
      buildWeeklySummary({
        mealCount: 8,
        workoutCount: 2,
        progressSummary: buildProgressSummary([
          weightRecord("previous", 79.2, "2026-06-05T08:00:00.000Z"),
          weightRecord("latest", 78.4, "2026-06-07T08:00:00.000Z"),
        ]),
      }),
    );

    assert.match(text, /Weekly summary/);
    assert.match(text, /Meals this week: 8/);
    assert.match(text, /Workouts this week: 2/);
    assert.match(text, /Latest weight: 78.4 kg/);
    assert.match(text, /Weight change: -0.8 kg/);
    assert.match(text, /Status: On track/);
  });
});

describe("progress conversation hardening", () => {
  it("does not create a second manual weight record after duplicate submit", async () => {
    const replies: string[] = [];
    let claimCount = 0;
    let createdCount = 0;

    const ctx = replyContext(replies);
    const options = {
      requireStepClaim: ConversationStep.WEIGHT_ENTRY,
      claimStep: async () => claimCount++ === 0,
      logWeight: async () => {
        createdCount += 1;
        return {};
      },
      resetState: async () => {},
    };

    await saveManualWeight(ctx, "user_1", "en", "78.4", options as any);
    await saveManualWeight(ctx, "user_1", "en", "78.4", options as any);

    assert.equal(createdCount, 1);
    assert.equal(replies.filter((reply) => reply.startsWith("Weight saved")).length, 1);
    assert.equal(
      replies.filter((reply) => reply.startsWith("Weight entry expired")).length,
      1,
    );
  });

  it("does not create a second weekly check-in after duplicate final submit", async () => {
    const replies: string[] = [];
    let claimCount = 0;
    let createdCount = 0;
    const payload = {
      weightKg: 78.4,
      nutritionAdherence: 4,
      trainingAdherence: 3,
      energy: 5,
    };
    const options = {
      claimStep: async () => claimCount++ === 0,
      completeCheckin: async () => {
        createdCount += 1;
        return {
          weightKg: 78.4,
          previousWeightKg: 79.2,
          mealCount: 8,
          workoutCount: 2,
          statusLabel: CheckinStatusLabel.ON_TRACK,
        };
      },
      resetState: async () => {},
    };
    const ctx = replyContext(replies);

    await finishCheckin(ctx, "user_1", "en", payload, null, options as any);
    await finishCheckin(ctx, "user_1", "en", payload, null, options as any);

    assert.equal(createdCount, 1);
    assert.equal(
      replies.filter((reply) => reply.startsWith("Check-in saved")).length,
      1,
    );
    assert.equal(
      replies.filter((reply) => reply.startsWith("Check-in step expired")).length,
      1,
    );
  });

  it("repeats the weight prompt after invalid WEIGHT_ENTRY input", async () => {
    const replies: string[] = [];
    let createdCount = 0;

    await saveManualWeight(replyContext(replies), "user_1", "en", "abc", {
      repeatPromptOnInvalid: true,
      requireStepClaim: ConversationStep.WEIGHT_ENTRY,
      claimStep: async () => true,
      logWeight: async () => {
        createdCount += 1;
        return {};
      },
      resetState: async () => {},
    } as any);

    assert.equal(createdCount, 0);
    assert.deepEqual(replies, [
      "Weight must be a number, for example 78 or 78.4.",
      "Enter your current weight in kg.",
    ]);
  });
});

function weightRecord(id: string, weightKg: number, checkedAt: string) {
  return {
    id,
    weightKg,
    checkedAt: new Date(checkedAt),
  };
}

function replyContext(replies: string[]) {
  return {
    reply: async (message: string) => {
      replies.push(message);
    },
  } as any;
}
