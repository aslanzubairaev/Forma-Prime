import { normalizeFoodText } from "./food-normalization.js";
import type { ParsedFoodItemCandidate } from "./food.types.js";

export type FoodLogParseResult = {
  items: ParsedFoodItemCandidate[];
  rejectedParts: string[];
};

const gramsUnitPattern = "(?:g|gr|gram|grams|г|гр|грамм|грамма|граммов)";
const leadingQuantityPattern = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}\\s+(.+)$`,
  "iu",
);
const trailingQuantityPattern = new RegExp(
  `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${gramsUnitPattern}$`,
  "iu",
);

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

  return parts.flatMap((part) => part.split(/\s+(?:and|и)\s+/iu));
}

function isDigit(value: string): boolean {
  return /^\d$/.test(value);
}

function parseFoodLogPart(part: string): ParsedFoodItemCandidate | null {
  const leadingMatch = part.match(leadingQuantityPattern);

  if (leadingMatch) {
    return buildParsedItem(leadingMatch[2], leadingMatch[1]);
  }

  const trailingMatch = part.match(trailingQuantityPattern);

  if (trailingMatch) {
    return buildParsedItem(trailingMatch[1], trailingMatch[2]);
  }

  return null;
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
