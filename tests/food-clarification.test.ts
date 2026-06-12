import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { t } from "../src/i18n/index.js";
import {
  buildClarifiedFoodCandidate,
  detectFoodAmbiguity,
  getFoodClarificationChoice,
} from "../src/nutrition/food-ambiguity.service.js";
import {
  buildFoodPreferenceUpsertArgs,
  foodPreferenceToClarificationChoice,
  type FoodPreferenceRecord,
} from "../src/nutrition/food-preference.service.js";

describe("food ambiguity clarification", () => {
  it("detects plain coffee as ambiguous without treating explicit coffee variants as ambiguous", () => {
    const coffee = detectFoodAmbiguity("кофе");

    assert.equal(coffee?.kind, "coffee");
    assert.equal(coffee.normalizedTriggerInput, "кофе");
    assert.deepEqual(
      coffee.choices.map((choice) => choice.foodSlug),
      ["coffee", "coffee-with-milk", "protein-coffee", "protein-ready-drink"],
    );
    assert.equal(detectFoodAmbiguity("кофе с молоком"), null);
    assert.equal(detectFoodAmbiguity("протеиновый кофе"), null);
    assert.equal(detectFoodAmbiguity("200 г риса"), null);
  });

  it("detects high-value ambiguous foods while preserving explicit variants", () => {
    const cases = [
      {
        input: "йогурт",
        kind: "yogurt",
        slugs: ["greek-yogurt", "fruit-yogurt", "drinkable-yogurt", "protein-yogurt"],
        explicit: ["греческий йогурт", "протеиновый йогурт"],
      },
      {
        input: "салат",
        kind: "salad",
        slugs: ["vegetable-salad", "chicken-salad", "mayo-salad"],
        explicit: ["салат с курицей", "овощной салат"],
      },
      {
        input: "сэндвич",
        kind: "sandwich",
        slugs: ["sandwich", "chicken-sandwich", "cheese-sandwich"],
        explicit: ["сэндвич с сыром", "сэндвич с курицей"],
      },
      {
        input: "бургер",
        kind: "burger",
        slugs: ["burger", "cheeseburger", "double-burger"],
        explicit: ["чизбургер", "двойной бургер"],
      },
    ] as const;

    for (const testCase of cases) {
      const ambiguity = detectFoodAmbiguity(testCase.input);

      assert.equal(ambiguity?.kind, testCase.kind, testCase.input);
      assert.deepEqual(
        ambiguity?.choices.map((choice) => choice.foodSlug),
        testCase.slugs,
        testCase.input,
      );

      for (const explicitInput of testCase.explicit) {
        assert.equal(detectFoodAmbiguity(explicitInput), null, explicitInput);
      }
    }
  });

  it("builds a deterministic parsed item from a clarification choice", () => {
    const choice = getFoodClarificationChoice("coffee", "protein_coffee");

    assert.ok(choice);
    const item = buildClarifiedFoodCandidate("кофе", choice);

    assert.equal(item.rawLabel, "кофе");
    assert.equal(item.normalizedLabel, "протеиновый кофе");
    assert.equal(item.unit, "serving");
    assert.equal(item.quantity, 1);
    assert.equal(item.grams, 330);
  });

  it("builds deterministic parsed items for expanded clarification choices", () => {
    const cases = [
      ["yogurt", "protein_yogurt", "протеиновый йогурт", 180],
      ["salad", "chicken_salad", "салат с курицей", 300],
      ["sandwich", "cheese_sandwich", "сэндвич с сыром", 180],
      ["burger", "double_burger", "двойной бургер", 320],
    ] as const;

    for (const [kind, choiceId, normalizedLabel, grams] of cases) {
      const choice = getFoodClarificationChoice(kind, choiceId);

      assert.ok(choice, `${kind}:${choiceId}`);
      const item = buildClarifiedFoodCandidate(kind, choice);

      assert.equal(item.normalizedLabel, normalizedLabel, `${kind}:${choiceId}`);
      assert.equal(item.unit, "serving", `${kind}:${choiceId}`);
      assert.equal(item.grams, grams, `${kind}:${choiceId}`);
    }
  });

  it("builds user-specific preference persistence data for a chosen clarification", () => {
    const choice = getFoodClarificationChoice("coffee", "protein_coffee");

    assert.ok(choice);
    const args = buildFoodPreferenceUpsertArgs({
      userId: "user_1",
      triggerInput: "  Кофе  ",
      choice,
    });

    assert.equal(args.where.userId_normalizedTriggerInput_preferenceKind.userId, "user_1");
    assert.equal(args.where.userId_normalizedTriggerInput_preferenceKind.normalizedTriggerInput, "кофе");
    assert.equal(args.create.preferredFoodSlug, "protein-coffee");
    assert.equal(args.create.preferredDisplayName, "Протеиновый кофе");
    assert.equal(args.create.confirmationCount, 1);
    assert.deepEqual(args.update.confirmationCount, { increment: 1 });
  });

  it("converts a saved preference back to a clarification choice for soft reuse", () => {
    const choice = foodPreferenceToClarificationChoice(
      preferenceRecord({
        preferredFoodSlug: "protein-coffee",
        preferredCanonicalName: "protein_coffee",
        preferredDisplayName: "Протеиновый кофе",
        preferredServingGrams: 330,
      }),
    );

    assert.equal(choice?.id, "protein_coffee");
    assert.equal(choice?.foodSlug, "protein-coffee");
    assert.equal(choice?.servingGrams, 330);
  });

  it("has short RU and EN clarification copy", () => {
    assert.match(t("ru", "food.clarify.coffee.question"), /кофе/i);
    assert.match(t("ru", "food.clarify.yogurt.question"), /йогурт/i);
    assert.match(t("ru", "food.clarify.salad.question"), /салат/i);
    assert.match(t("ru", "food.clarify.sandwich.question"), /сэндвич/i);
    assert.match(t("ru", "food.clarify.burger.question"), /бургер/i);
    assert.match(t("en", "food.clarify.coffee.question"), /coffee/i);
    assert.match(t("en", "food.clarify.yogurt.question"), /yogurt/i);
    assert.match(t("en", "food.clarify.salad.question"), /salad/i);
    assert.match(t("en", "food.clarify.sandwich.question"), /sandwich/i);
    assert.match(t("en", "food.clarify.burger.question"), /burger/i);
    assert.match(t("ru", "food.clarify.reuseConfirm", { trigger: "кофе", choice: "Протеиновый кофе" }), /Обычно/i);
    assert.match(t("en", "food.clarify.reuseConfirm", { trigger: "coffee", choice: "Protein coffee" }), /Usually/i);
  });
});

function preferenceRecord(
  input: Partial<FoodPreferenceRecord>,
): FoodPreferenceRecord {
  return {
    id: input.id ?? "pref_1",
    userId: input.userId ?? "user_1",
    triggerInput: input.triggerInput ?? "кофе",
    normalizedTriggerInput: input.normalizedTriggerInput ?? "кофе",
    preferredCanonicalName: input.preferredCanonicalName ?? "coffee",
    preferredDisplayName: input.preferredDisplayName ?? "Кофе",
    preferredFoodSlug: input.preferredFoodSlug ?? "coffee",
    preferredServingGrams: input.preferredServingGrams ?? 200,
    preferenceKind: input.preferenceKind ?? "clarification_choice",
    confirmationCount: input.confirmationCount ?? 1,
    lastConfirmedAt: input.lastConfirmedAt ?? new Date("2026-06-13T00:00:00.000Z"),
    createdAt: input.createdAt ?? new Date("2026-06-13T00:00:00.000Z"),
    updatedAt: input.updatedAt ?? new Date("2026-06-13T00:00:00.000Z"),
    isActive: input.isActive ?? true,
  };
}
