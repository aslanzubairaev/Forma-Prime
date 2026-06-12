import type { SupportedLanguage } from "../i18n/index.js";
import { normalizeFoodText } from "./food-normalization.js";
import type { ParsedFoodItemCandidate } from "./food.types.js";

export type FoodAmbiguityKind = "coffee";

export type FoodClarificationChoice = {
  id: string;
  kind: FoodAmbiguityKind;
  foodSlug: string;
  canonicalName: string;
  displayNameRu: string;
  displayNameEn: string;
  normalizedLabel: string;
  servingGrams: number;
};

export type FoodAmbiguity = {
  kind: FoodAmbiguityKind;
  triggerInput: string;
  normalizedTriggerInput: string;
  choices: FoodClarificationChoice[];
};

const wrapperWords = new Set([
  "сегодня",
  "пил",
  "пила",
  "выпил",
  "выпила",
  "я",
]);

const coffeeChoices: FoodClarificationChoice[] = [
  {
    id: "black_coffee",
    kind: "coffee",
    foodSlug: "coffee",
    canonicalName: "black_coffee",
    displayNameRu: "Обычный чёрный кофе",
    displayNameEn: "Black coffee",
    normalizedLabel: "кофе",
    servingGrams: 200,
  },
  {
    id: "coffee_with_milk",
    kind: "coffee",
    foodSlug: "coffee-with-milk",
    canonicalName: "coffee_with_milk",
    displayNameRu: "Кофе с молоком",
    displayNameEn: "Coffee with milk",
    normalizedLabel: "кофе с молоком",
    servingGrams: 250,
  },
  {
    id: "protein_coffee",
    kind: "coffee",
    foodSlug: "protein-coffee",
    canonicalName: "protein_coffee",
    displayNameRu: "Протеиновый кофе",
    displayNameEn: "Protein coffee",
    normalizedLabel: "протеиновый кофе",
    servingGrams: 330,
  },
  {
    id: "protein_ready_drink",
    kind: "coffee",
    foodSlug: "protein-ready-drink",
    canonicalName: "protein_ready_drink",
    displayNameRu: "Готовый магазинный протеиновый напиток",
    displayNameEn: "Ready protein drink",
    normalizedLabel: "готовый протеиновый напиток",
    servingGrams: 330,
  },
];

const choicesByKind: Record<FoodAmbiguityKind, FoodClarificationChoice[]> = {
  coffee: coffeeChoices,
};

export function detectFoodAmbiguity(rawInput: string): FoodAmbiguity | null {
  const normalizedTriggerInput = stripWrapperWords(normalizeFoodText(rawInput));

  if (normalizedTriggerInput === "кофе" || normalizedTriggerInput === "coffee") {
    return {
      kind: "coffee",
      triggerInput: rawInput.trim(),
      normalizedTriggerInput,
      choices: coffeeChoices,
    };
  }

  return null;
}

export function getFoodClarificationChoice(
  kind: FoodAmbiguityKind,
  choiceId: string,
): FoodClarificationChoice | null {
  return choicesByKind[kind].find((choice) => choice.id === choiceId) ?? null;
}

export function getFoodClarificationChoiceBySlug(
  foodSlug: string,
): FoodClarificationChoice | null {
  return (
    Object.values(choicesByKind)
      .flat()
      .find((choice) => choice.foodSlug === foodSlug) ?? null
  );
}

export function buildClarifiedFoodCandidate(
  rawInput: string,
  choice: FoodClarificationChoice,
): ParsedFoodItemCandidate {
  return {
    rawLabel: rawInput.trim(),
    normalizedLabel: choice.normalizedLabel,
    quantity: 1,
    unit: "serving",
    grams: choice.servingGrams,
  };
}

export function getFoodClarificationChoiceLabel(
  choice: FoodClarificationChoice,
  language: SupportedLanguage,
): string {
  return language === "ru" ? choice.displayNameRu : choice.displayNameEn;
}

function stripWrapperWords(value: string): string {
  return value
    .split(" ")
    .filter((token) => !wrapperWords.has(token))
    .join(" ")
    .trim();
}
