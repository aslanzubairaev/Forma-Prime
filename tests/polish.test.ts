import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.BOT_TOKEN = "test-token";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";

const { formatTextFallback } = await import("../src/bot/fallback.js");
const { formatHelpText } = await import("../src/bot/help.js");
const { mainMenuText } = await import("../src/bot/menu.js");
const { loadEnv } = await import("../src/config/env.js");
const { t } = await import("../src/i18n/index.js");

describe("help and discoverability polish", () => {
  it("lists the implemented V1 command families", () => {
    const text = formatHelpText("en");

    assert.match(text, /\/start/);
    assert.match(text, /\/food/);
    assert.match(text, /\/workout/);
    assert.match(text, /\/weight/);
    assert.match(text, /\/customfood/);
    assert.match(text, /\/recentfoods/);
    assert.match(text, /\/lastmeal/);
    assert.match(text, /\/lastworkout/);
    assert.match(text, /\/reminders/);
  });

  it("keeps menu copy concrete instead of placeholder-based", () => {
    const text = [
      mainMenuText("en"),
      t("en", "menu.section.nutrition"),
      t("en", "menu.section.workout"),
      t("en", "menu.section.progress"),
    ].join("\n");

    assert.doesNotMatch(text, /placeholder/i);
    assert.match(text, /\/recentfoods/);
    assert.match(text, /\/finishworkout/);
    assert.match(text, /\/checkin/);
  });

  it("does not expose AI provider setup in normal food help", () => {
    assert.doesNotMatch(t("en", "food.command.help"), /AI|provider/i);
    assert.doesNotMatch(t("ru", "food.command.help"), /AI|провайдер/i);
  });
});

describe("empty state and stale flow polish", () => {
  it("points empty states to a useful next action", () => {
    assert.match(t("en", "meals.empty"), /200 g chicken breast/);
    assert.match(t("en", "workout.noneToday"), /\/workout/);
    assert.match(t("en", "progress.empty"), /\/weight/);
    assert.match(t("en", "recentFoods.empty"), /Log a meal/);
    assert.match(t("en", "lastMeal.empty"), /200 g chicken breast/);
    assert.match(t("en", "lastWorkout.empty"), /\/workout/);
  });

  it("keeps stale messages short and restartable", () => {
    assert.match(t("en", "food.clarificationExpired"), /expired/);
    assert.match(t("en", "reminders.expired"), /\/remindme/);
    assert.match(t("en", "lastMeal.expired"), /\/lastmeal/);
    assert.match(t("en", "lastWorkout.expired"), /\/lastworkout/);
  });
});

describe("fallback behavior polish", () => {
  it("returns short guidance for unmatched text", () => {
    const text = formatTextFallback("en");

    assert.match(text, /\/help/);
    assert.match(text, /\/start/);
  });

  it("separates matched, unmatched, and next action in partial food fallback", () => {
    const english = t("en", "food.partialUnmatched", {
      matched: "White rice",
      unmatched: "unknown sauce",
    });
    const russian = t("ru", "food.partialUnmatched", {
      matched: "Рис белый",
      unmatched: "непонятный соус",
    });

    assert.match(english, /Understood and logged: White rice/);
    assert.match(english, /Not found: unknown sauce/);
    assert.match(english, /\/customfood/);
    assert.match(russian, /Понял и записал: Рис белый/);
    assert.match(russian, /Не найдено: непонятный соус/);
    assert.match(russian, /\/customfood/);
  });
});

describe("environment validation", () => {
  it("fails fast with a clear message when critical env is missing", () => {
    assert.throws(
      () => loadEnv({ DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/postgres" }),
      /Invalid environment configuration: BOT_TOKEN/,
    );
  });

  it("trims required env and applies safe defaults", () => {
    const env = loadEnv({
      BOT_TOKEN: " test-token ",
      DATABASE_URL: " postgresql://postgres:postgres@localhost:5432/postgres ",
    });

    assert.equal(env.BOT_TOKEN, "test-token");
    assert.equal(env.LOG_LEVEL, "info");
    assert.equal(env.OPENAI_FOOD_DRAFT_MODEL, "gpt-4.1-mini");
  });
});
