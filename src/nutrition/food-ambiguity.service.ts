import type { SupportedLanguage } from "../i18n/index.js";
import { normalizeFoodText } from "./food-normalization.js";
import type { ParsedFoodItemCandidate } from "./food.types.js";

export type FoodAmbiguityKind =
  | "coffee"
  | "yogurt"
  | "salad"
  | "sandwich"
  | "burger";

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

const yogurtChoices: FoodClarificationChoice[] = [
  {
    id: "greek_yogurt",
    kind: "yogurt",
    foodSlug: "greek-yogurt",
    canonicalName: "greek_yogurt",
    displayNameRu: "Греческий йогурт",
    displayNameEn: "Greek yogurt",
    normalizedLabel: "греческий йогурт",
    servingGrams: 170,
  },
  {
    id: "fruit_yogurt",
    kind: "yogurt",
    foodSlug: "fruit-yogurt",
    canonicalName: "fruit_yogurt",
    displayNameRu: "Сладкий фруктовый йогурт",
    displayNameEn: "Sweet fruit yogurt",
    normalizedLabel: "фруктовый йогурт",
    servingGrams: 150,
  },
  {
    id: "drinkable_yogurt",
    kind: "yogurt",
    foodSlug: "drinkable-yogurt",
    canonicalName: "drinkable_yogurt",
    displayNameRu: "Питьевой йогурт",
    displayNameEn: "Drinkable yogurt",
    normalizedLabel: "питьевой йогурт",
    servingGrams: 290,
  },
  {
    id: "protein_yogurt",
    kind: "yogurt",
    foodSlug: "protein-yogurt",
    canonicalName: "protein_yogurt",
    displayNameRu: "Протеиновый йогурт",
    displayNameEn: "Protein yogurt",
    normalizedLabel: "протеиновый йогурт",
    servingGrams: 180,
  },
];

const saladChoices: FoodClarificationChoice[] = [
  {
    id: "vegetable_salad",
    kind: "salad",
    foodSlug: "vegetable-salad",
    canonicalName: "vegetable_salad",
    displayNameRu: "Овощной салат",
    displayNameEn: "Vegetable salad",
    normalizedLabel: "овощной салат",
    servingGrams: 250,
  },
  {
    id: "chicken_salad",
    kind: "salad",
    foodSlug: "chicken-salad",
    canonicalName: "chicken_salad",
    displayNameRu: "Салат с курицей",
    displayNameEn: "Chicken salad",
    normalizedLabel: "салат с курицей",
    servingGrams: 300,
  },
  {
    id: "mayo_salad",
    kind: "salad",
    foodSlug: "mayo-salad",
    canonicalName: "mayo_salad",
    displayNameRu: "Салат с майонезом",
    displayNameEn: "Mayo-based salad",
    normalizedLabel: "салат с майонезом",
    servingGrams: 200,
  },
];

const sandwichChoices: FoodClarificationChoice[] = [
  {
    id: "simple_sandwich",
    kind: "sandwich",
    foodSlug: "sandwich",
    canonicalName: "simple_sandwich",
    displayNameRu: "Простой бутерброд",
    displayNameEn: "Simple sandwich",
    normalizedLabel: "бутерброд",
    servingGrams: 180,
  },
  {
    id: "chicken_sandwich",
    kind: "sandwich",
    foodSlug: "chicken-sandwich",
    canonicalName: "chicken_sandwich",
    displayNameRu: "Сэндвич с курицей",
    displayNameEn: "Chicken sandwich",
    normalizedLabel: "сэндвич с курицей",
    servingGrams: 220,
  },
  {
    id: "cheese_sandwich",
    kind: "sandwich",
    foodSlug: "cheese-sandwich",
    canonicalName: "cheese_sandwich",
    displayNameRu: "Сэндвич с сыром",
    displayNameEn: "Cheese sandwich",
    normalizedLabel: "сэндвич с сыром",
    servingGrams: 180,
  },
];

const burgerChoices: FoodClarificationChoice[] = [
  {
    id: "burger",
    kind: "burger",
    foodSlug: "burger",
    canonicalName: "burger",
    displayNameRu: "Обычный бургер",
    displayNameEn: "Burger",
    normalizedLabel: "бургер",
    servingGrams: 250,
  },
  {
    id: "cheeseburger",
    kind: "burger",
    foodSlug: "cheeseburger",
    canonicalName: "cheeseburger",
    displayNameRu: "Чизбургер",
    displayNameEn: "Cheeseburger",
    normalizedLabel: "чизбургер",
    servingGrams: 220,
  },
  {
    id: "double_burger",
    kind: "burger",
    foodSlug: "double-burger",
    canonicalName: "double_burger",
    displayNameRu: "Двойной бургер",
    displayNameEn: "Double burger",
    normalizedLabel: "двойной бургер",
    servingGrams: 320,
  },
];

const choicesByKind: Record<FoodAmbiguityKind, FoodClarificationChoice[]> = {
  coffee: coffeeChoices,
  yogurt: yogurtChoices,
  salad: saladChoices,
  sandwich: sandwichChoices,
  burger: burgerChoices,
};

const ambiguityTriggers: Record<FoodAmbiguityKind, string[]> = {
  coffee: ["кофе", "coffee"],
  yogurt: ["йогурт", "yogurt"],
  salad: ["салат", "salad"],
  sandwich: ["сэндвич", "sandwich"],
  burger: ["бургер", "burger"],
};

export function detectFoodAmbiguity(rawInput: string): FoodAmbiguity | null {
  const normalizedTriggerInput = stripWrapperWords(normalizeFoodText(rawInput));
  const kind = findAmbiguityKind(normalizedTriggerInput);

  if (kind) {
    return {
      kind,
      triggerInput: rawInput.trim(),
      normalizedTriggerInput,
      choices: choicesByKind[kind],
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

function findAmbiguityKind(value: string): FoodAmbiguityKind | null {
  for (const [kind, triggers] of Object.entries(ambiguityTriggers)) {
    if (triggers.includes(value)) {
      return kind as FoodAmbiguityKind;
    }
  }

  return null;
}
