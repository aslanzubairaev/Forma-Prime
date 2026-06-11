import { normalizeFoodText } from "./food-normalization.js";
import type { ParsedFoodItemCandidate } from "./food.types.js";

export type FoodLogParseResult = {
  items: ParsedFoodItemCandidate[];
  rejectedParts: string[];
};

const gramsUnitPattern = "(?:g|gr|gram|grams|г|гр|грамм|грамма|граммов)\\.?"
const leadingQuantityPattern = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}\\s+(.+)$`,
  "iu",
);
const trailingQuantityPattern = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}$`,
  "iu",
);
const servingQuantityPattern = /^(\d+(?:[.,]\d+)?)\s+(.+)$/iu;

const servingRules = [
  {
    terms: ["жарен", "жарё", "fried egg", "fried eggs"],
    normalizedLabel: "жареные яйца",
    unit: "piece",
    gramsPerServing: 50,
  },
  {
    terms: ["варен", "варё", "boiled egg", "boiled eggs"],
    normalizedLabel: "вареные яйца",
    unit: "piece",
    gramsPerServing: 50,
  },
  {
    terms: ["egg", "eggs", "яйцо", "яйца", "яиц", "яйцами"],
    normalizedLabel: "яйца",
    unit: "piece",
    gramsPerServing: 50,
  },
  {
    terms: ["protein bar", "протеиновый батончик", "протеиновый бар"],
    normalizedLabel: "протеиновый батончик",
    unit: "serving",
    gramsPerServing: 60,
  },
  {
    terms: [
      "protein",
      "scoop protein",
      "whey",
      "протеин",
      "протеина",
      "порция протеина",
      "порции протеина",
    ],
    normalizedLabel: "протеин",
    unit: "serving",
    gramsPerServing: 30,
  },
  {
    terms: ["батончик", "snack bar"],
    normalizedLabel: "батончик",
    unit: "serving",
    gramsPerServing: 50,
  },
  {
    terms: ["банан", "banana"],
    normalizedLabel: "банан",
    unit: "piece",
    gramsPerServing: 120,
  },
  {
    terms: ["яблок", "apple"],
    normalizedLabel: "яблоко",
    unit: "piece",
    gramsPerServing: 150,
  },
  {
    terms: ["кусок хлеб", "кусочка хлеб", "ломтик хлеб", "ломтика хлеб", "bread slice"],
    normalizedLabel: "хлеб",
    unit: "piece",
    gramsPerServing: 35,
  },
  {
    terms: ["лаваш", "lavash"],
    normalizedLabel: "лаваш",
    unit: "piece",
    gramsPerServing: 60,
  },
] as const;

const quickMealRules = [
  {
    terms: ["протеиновый кофе", "кофе с протеином", "protein coffee"],
    normalizedLabel: "протеиновый кофе",
    grams: 330,
  },
  {
    terms: [
      "лаваш с курицей",
      "домашняя шаурма",
      "шаурма домашняя",
      "chicken lavash wrap",
      "chicken wrap",
    ],
    normalizedLabel: "лаваш с курицей",
    grams: 250,
  },
  {
    terms: ["протеиновый батончик", "протеиновый бар", "protein bar"],
    normalizedLabel: "протеиновый батончик",
    grams: 60,
  },
  {
    terms: ["кофе с молоком", "coffee with milk"],
    normalizedLabel: "кофе с молоком",
    grams: 250,
  },
] as const;

export function parseFoodLogMessage(input: string): FoodLogParseResult {
  const parts = splitFoodLogParts(input)
    .map((part) => part.trim())
    .filter(Boolean);

  const items: ParsedFoodItemCandidate[] = [];
  const rejectedParts: string[] = [];

  for (const part of parts) {
    const parsed = parseFoodLogPart(part);

    if (parsed) {
      items.push(parsed);
    } else {
      rejectedParts.push(part);
    }
  }

  return {
    items,
    rejectedParts,
  };
}

function splitFoodLogParts(input: string): string[] {
  const parts: string[] = [];
  let current = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (char === ",") {
      const previous = input[index - 1] ?? "";
      const next = input[index + 1] ?? "";

      if (!isDigit(previous) || !isDigit(next)) {
        parts.push(current);
        current = "";
        continue;
      }
    }

    current += char;
  }

  parts.push(current);

  return parts
    .flatMap((part) => part.split(/\s*(?:[;\r\n]+|\+)\s*/u))
    .flatMap((part) => part.split(/\s+(?:and|и)\s+/iu));
}

function isDigit(value: string): boolean {
  return /^\d$/.test(value);
}

function parseFoodLogPart(part: string): ParsedFoodItemCandidate | null {
  const quickMeal = buildQuickMealParsedItem(part);

  if (quickMeal) {
    return quickMeal;
  }

  const leadingMatch = part.match(leadingQuantityPattern);

  if (leadingMatch) {
    return buildParsedItem(leadingMatch[2], leadingMatch[1]);
  }

  const trailingMatch = part.match(trailingQuantityPattern);

  if (trailingMatch) {
    return buildParsedItem(trailingMatch[1], trailingMatch[2]);
  }

  const servingMatch = part.match(servingQuantityPattern);

  if (servingMatch) {
    return buildServingParsedItem(servingMatch[2], servingMatch[1]);
  }

  return null;
}

function buildQuickMealParsedItem(part: string): ParsedFoodItemCandidate | null {
  const label = part.trim();

  if (!label) {
    return null;
  }

  const normalizedLabel = normalizeFoodText(label);
  const rule = quickMealRules.find((candidate) =>
    candidate.terms.some((term) => normalizedLabel === normalizeFoodText(term)),
  );

  if (!rule) {
    return null;
  }

  return {
    rawLabel: label,
    normalizedLabel: rule.normalizedLabel,
    quantity: 1,
    unit: "serving",
    grams: rule.grams,
  };
}

function buildParsedItem(
  rawLabel: string | undefined,
  rawQuantity: string | undefined,
): ParsedFoodItemCandidate | null {
  if (!rawLabel || !rawQuantity) {
    return null;
  }

  const quantity = Number(rawQuantity.replace(",", "."));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const label = rawLabel.trim();

  if (!label) {
    return null;
  }

  return {
    rawLabel: label,
    normalizedLabel: normalizeFoodText(label),
    quantity,
    unit: "g",
    grams: quantity,
  };
}

function buildServingParsedItem(
  rawLabel: string | undefined,
  rawQuantity: string | undefined,
): ParsedFoodItemCandidate | null {
  if (!rawLabel || !rawQuantity) {
    return null;
  }

  const quantity = Number(rawQuantity.replace(",", "."));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const label = rawLabel.trim();

  if (!label) {
    return null;
  }

  const normalizedLabel = normalizeFoodText(label);
  const rule = servingRules.find((candidate) =>
    candidate.terms.some((term) => normalizedLabel.includes(term)),
  );

  if (!rule) {
    return null;
  }

  return {
    rawLabel: label,
    normalizedLabel: rule.normalizedLabel,
    quantity,
    unit: rule.unit,
    grams: quantity * rule.gramsPerServing,
  };
}
