import { env } from "../config/env.js";
import type { SupportedLanguage } from "../i18n/index.js";
import { normalizeFoodText } from "../nutrition/food-normalization.js";
import type { ParsedFoodItemCandidate } from "../nutrition/food.types.js";
import type {
  FoodDraftParserAdapter,
  FoodDraftResult,
  NormalizedFoodDraftResult,
} from "./ai-food-draft.types.js";
import { createOpenAiFoodDraftParserAdapter } from "./openai-food-draft.adapter.js";

const defaultFoodDraftParserAdapter = createOpenAiFoodDraftParserAdapter({
  apiKey: env.OPENAI_API_KEY,
  model: env.OPENAI_FOOD_DRAFT_MODEL,
});

const gramUnits = new Set([
  "g",
  "gr",
  "gram",
  "grams",
  "г",
  "гр",
  "грамм",
  "грамма",
  "граммов",
]);

export async function parseFoodDraft(
  rawText: string,
  language: SupportedLanguage,
  adapter: FoodDraftParserAdapter = defaultFoodDraftParserAdapter,
): Promise<NormalizedFoodDraftResult | { status: "failed"; items: [] }> {
  try {
    const draft = await adapter.parseFoodDraft(rawText, language);

    if (draft.status !== "parsed") {
      return {
        status: draft.status === "failed" ? "failed" : "empty",
        items: [],
      };
    }

    return normalizeFoodDraft(draft);
  } catch {
    return {
      status: "failed",
      items: [],
    };
  }
}

export function normalizeFoodDraft(
  draft: FoodDraftResult,
): NormalizedFoodDraftResult {
  if (draft.status !== "parsed" || !Array.isArray(draft.items)) {
    return {
      status: "empty",
      items: [],
    };
  }

  const items = draft.items
    .map(normalizeFoodDraftItem)
    .filter((item): item is ParsedFoodItemCandidate => item !== null);

  return {
    status: items.length > 0 ? "ok" : "empty",
    items,
  };
}

function normalizeFoodDraftItem(value: unknown): ParsedFoodItemCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.label !== "string") {
    return null;
  }

  const rawLabel = value.label.trim();

  if (!rawLabel) {
    return null;
  }

  if (typeof value.quantity !== "number" || !Number.isFinite(value.quantity)) {
    return null;
  }

  if (value.quantity <= 0) {
    return null;
  }

  if (typeof value.unit !== "string") {
    return null;
  }

  const unit = value.unit.trim().toLowerCase();

  if (!gramUnits.has(unit)) {
    return null;
  }

  return {
    rawLabel,
    normalizedLabel: normalizeFoodText(rawLabel),
    quantity: value.quantity,
    unit: "g",
    grams: value.quantity,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
