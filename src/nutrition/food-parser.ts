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
const embeddedQuantityPattern = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}\\s+(.+)$`,
  "iu",
);
const servingQuantityPattern = /^(\d+(?:[.,]\d+)?)\s+(.+)$/iu;
const nutritionHintPattern = new RegExp(
  `^\\d+(?:[.,]\\d+)?\\s*${gramsUnitPattern}\\s+(?:белка|белок|protein)$`,
  "iu",
);

const conversationalWrapperWords = new Set([
  "сегодня",
  "ел",
  "ела",
  "съел",
  "съела",
  "пил",
  "пила",
  "выпил",
  "выпила",
  "покушал",
  "покушала",
  "съелa",
  "кушал",
  "кушала",
  "я",
]);

const numberWords: Record<string, number> = {
  один: 1,
  одна: 1,
  одно: 1,
  две: 2,
  два: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
};

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
      "изолят",
      "изолята",
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
  {
    terms: ["тортилья", "тортильи", "tortilla"],
    normalizedLabel: "тортилья",
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
      "домашние шаурмы",
      "домашнюю шаурму",
      "chicken lavash wrap",
      "chicken wrap",
    ],
    normalizedLabel: "лаваш с курицей",
    grams: 250,
    isEstimate: true,
  },
  {
    terms: ["шаурма", "шаурмы", "шаурму", "shawarma"],
    normalizedLabel: "шаурма",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["такос", "тако", "taco", "tacos"],
    normalizedLabel: "такос",
    grams: 180,
    isEstimate: true,
  },
  {
    terms: ["буррито", "burrito"],
    normalizedLabel: "буррито",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["бутерброд", "бутерброда", "бутер", "сэндвич", "сэндвича", "sandwich"],
    normalizedLabel: "бутерброд",
    grams: 180,
    isEstimate: true,
  },
  {
    terms: ["рис с курицей", "курица с рисом", "chicken rice", "rice with chicken"],
    normalizedLabel: "рис с курицей",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["паста с курицей", "макароны с курицей", "chicken pasta", "pasta with chicken"],
    normalizedLabel: "паста с курицей",
    grams: 350,
    isEstimate: true,
  },
  {
    terms: ["салат с курицей", "куриный салат", "chicken salad"],
    normalizedLabel: "салат с курицей",
    grams: 300,
    isEstimate: true,
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
  {
    terms: ["кофе", "coffee"],
    normalizedLabel: "кофе",
    grams: 200,
  },
  {
    terms: ["кола зеро", "cola zero", "coke zero", "zero cola"],
    normalizedLabel: "кола зеро",
    grams: 330,
  },
] as const;

export function parseFoodLogMessage(input: string): FoodLogParseResult {
  const ingredientSection = extractIngredientSection(input);

  if (ingredientSection) {
    return parseFoodLogMessage(ingredientSection);
  }

  const parts = splitFoodLogParts(input)
    .map((part) => part.trim())
    .filter(Boolean);

  const items: ParsedFoodItemCandidate[] = [];
  const rejectedParts: string[] = [];

  for (const part of parts) {
    if (isNutritionHintPart(part)) {
      if (items.length > 0) {
        continue;
      }

      rejectedParts.push(part);
      continue;
    }

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
  const conversationalServing = buildConversationalServingParsedItem(part);

  if (conversationalServing) {
    return conversationalServing;
  }

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

  const embeddedMatch = part.match(embeddedQuantityPattern);

  if (embeddedMatch) {
    return buildParsedItem(
      stripConversationalWrappers(
        [embeddedMatch[1], embeddedMatch[3]].filter(Boolean).join(" "),
      ),
      embeddedMatch[2],
    );
  }

  const servingMatch = part.match(servingQuantityPattern);

  if (servingMatch) {
    return buildServingParsedItem(servingMatch[2], servingMatch[1]);
  }

  return null;
}

function buildConversationalServingParsedItem(
  part: string,
): ParsedFoodItemCandidate | null {
  const label = part.trim();

  if (!label) {
    return null;
  }

  const normalizedLabel = normalizeFoodText(label);
  const strippedLabel = stripConversationalWrappers(normalizedLabel);

  if (isProteinCoffeeText(strippedLabel)) {
    return buildServingItem(label, "протеиновый кофе", 1, 330);
  }

  if (isCoffeeWithMilkText(strippedLabel)) {
    return buildServingItem(label, "кофе с молоком", 1, 250);
  }

  if (isPlainCoffeeText(strippedLabel)) {
    return buildServingItem(label, "кофе", 1, 200);
  }

  if (isProteinText(strippedLabel)) {
    const quantity = extractQuantityNearServingUnit(strippedLabel);

    if (quantity) {
      return buildServingItem(
        stripQuantityWords(strippedLabel),
        "протеин",
        quantity,
        quantity * 30,
      );
    }

    if (!extractAnyQuantity(strippedLabel)) {
      return buildServingItem(
        stripQuantityWords(strippedLabel),
        "протеин",
        1,
        30,
      );
    }
  }

  if (isEggText(strippedLabel)) {
    const quantity = extractAnyQuantity(strippedLabel);

    if (quantity) {
      const normalizedEggLabel = isFriedEggText(strippedLabel)
        ? "жареные яйца"
        : isBoiledEggText(strippedLabel)
          ? "вареные яйца"
          : "яйца";

      return {
        rawLabel: stripQuantityWords(strippedLabel),
        normalizedLabel: normalizedEggLabel,
        quantity,
        unit: "piece",
        grams: quantity * 50,
      };
    }
  }

  return null;
}

function buildQuickMealParsedItem(part: string): ParsedFoodItemCandidate | null {
  const label = part.trim();

  if (!label) {
    return null;
  }

  const normalizedLabel = normalizeFoodText(label);
  const strippedLabel = stripConversationalWrappers(normalizedLabel);
  const rule = findQuickMealRule(strippedLabel);

  if (!rule) {
    return null;
  }

  const quantity = extractAnyQuantity(strippedLabel) ?? 1;

  return {
    rawLabel: label,
    normalizedLabel: rule.normalizedLabel,
    quantity,
    unit: "serving",
    grams: quantity * rule.grams,
    ...("isEstimate" in rule && rule.isEstimate ? { isEstimate: true } : {}),
  };
}

function buildServingItem(
  rawLabel: string,
  normalizedLabel: string,
  quantity: number,
  grams: number,
): ParsedFoodItemCandidate {
  return {
    rawLabel,
    normalizedLabel,
    quantity,
    unit: "serving",
    grams,
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
  const strippedLabel = stripConversationalWrappers(label);

  if (!strippedLabel) {
    return null;
  }

  return {
    rawLabel: strippedLabel,
    normalizedLabel: normalizeFoodText(strippedLabel),
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

function extractIngredientSection(input: string): string | null {
  const [prefix, ...rest] = input.split(":");

  if (!prefix || rest.length === 0) {
    return null;
  }

  const normalizedPrefix = stripConversationalWrappers(prefix);

  if (!findQuickMealRule(normalizedPrefix)) {
    return null;
  }

  const ingredientText = rest.join(":").trim();

  return ingredientText.length > 0 ? ingredientText : null;
}

function findQuickMealRule(value: string): (typeof quickMealRules)[number] | null {
  const strippedValue = stripQuantityWords(value);

  return (
    quickMealRules.find((candidate) =>
      candidate.terms.some((term) => {
        const normalizedTerm = normalizeFoodText(term);

        return (
          strippedValue === normalizedTerm ||
          isTokenSubsetMatch(strippedValue, normalizedTerm)
        );
      }),
    ) ?? null
  );
}

function stripConversationalWrappers(value: string): string {
  return normalizeFoodText(value)
    .split(" ")
    .filter((token) => !conversationalWrapperWords.has(token))
    .join(" ")
    .trim();
}

function isNutritionHintPart(part: string): boolean {
  return nutritionHintPattern.test(normalizeFoodText(part));
}

function isProteinText(value: string): boolean {
  return (
    value.includes("протеин") ||
    value.includes("изолят") ||
    /\b(?:protein|whey|isolate)\b/iu.test(value)
  );
}

function isProteinCoffeeText(value: string): boolean {
  return hasToken(value, "кофе") && isProteinText(value);
}

function isCoffeeWithMilkText(value: string): boolean {
  return hasToken(value, "кофе") && value.includes("молок");
}

function isPlainCoffeeText(value: string): boolean {
  return hasToken(value, "кофе") || /\bcoffee\b/iu.test(value);
}

function isEggText(value: string): boolean {
  return /(?:^|\s)я(?:й|и)ц/iu.test(value) || /\beggs?\b/iu.test(value);
}

function isFriedEggText(value: string): boolean {
  return value.includes("жарен") || value.includes("жарё") || value.includes("fried");
}

function isBoiledEggText(value: string): boolean {
  return value.includes("варен") || value.includes("варё") || value.includes("boiled");
}

function hasToken(value: string, token: string): boolean {
  return value.split(" ").includes(token);
}

function extractQuantityNearServingUnit(value: string): number | null {
  const tokens = value.split(" ");

  for (let index = 0; index < tokens.length; index += 1) {
    const quantity = parseQuantityToken(tokens[index] ?? "");

    if (!quantity) {
      continue;
    }

    const nearbyTokens = tokens.slice(index + 1, index + 4).join(" ");

    if (/(?:порци|ложк|scoop|serving)/iu.test(nearbyTokens)) {
      return quantity;
    }
  }

  return null;
}

function extractAnyQuantity(value: string): number | null {
  for (const token of value.split(" ")) {
    const quantity = parseQuantityToken(token);

    if (quantity) {
      return quantity;
    }
  }

  return null;
}

function parseQuantityToken(value: string): number | null {
  const normalizedValue = normalizeFoodText(value);

  if (/^\d+(?:[.,]\d+)?$/.test(normalizedValue)) {
    const quantity = Number(normalizedValue.replace(",", "."));
    return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
  }

  return numberWords[normalizedValue] ?? null;
}

function stripQuantityWords(value: string): string {
  return value
    .split(" ")
    .filter(
      (token) =>
        !parseQuantityToken(token) &&
        !/^(?:шт|штук|штуки|штука)$/iu.test(token),
    )
    .join(" ")
    .trim();
}

function isTokenSubsetMatch(value: string, term: string): boolean {
  const valueTokens = getMeaningfulTokens(value);
  const termTokens = getMeaningfulTokens(term);

  if (valueTokens.length < 2 || termTokens.length < 2) {
    return false;
  }

  const valueTokenSet = new Set(valueTokens);
  const termTokenSet = new Set(termTokens);

  return (
    termTokens.every((token) => valueTokenSet.has(token)) ||
    valueTokens.every((token) => termTokenSet.has(token))
  );
}

function getMeaningfulTokens(value: string): string[] {
  return normalizeFoodText(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !parseQuantityToken(token) &&
        !/^(?:шт|штук|штуки|штука)$/iu.test(token),
    );
}
