import type { SupportedLanguage } from "../i18n/index.js";

export type FoodDraftItem = {
  label?: unknown;
  quantity?: unknown;
  unit?: unknown;
  confidence?: unknown;
};

export type FoodDraftResult =
  | {
      status: "parsed";
      items: FoodDraftItem[];
    }
  | {
      status: "unavailable" | "failed";
    };

export type NormalizedFoodDraftResult = {
  status: "ok" | "empty";
  items: import("../nutrition/food.types.js").ParsedFoodItemCandidate[];
};

export type FoodDraftParserAdapter = {
  parseFoodDraft(
    rawText: string,
    language: SupportedLanguage,
  ): Promise<FoodDraftResult>;
};
