import { normalizeFoodText } from "./food-normalization.js";
import type {
  FoodMatchResult,
  NutritionFoodRecord,
  ParsedFoodItemCandidate,
} from "./food.types.js";

export function matchFoodCandidate(
  candidate: ParsedFoodItemCandidate,
  foods: NutritionFoodRecord[],
): FoodMatchResult {
  const activeFoods = foods;
  const normalizedLabel = candidate.normalizedLabel;
  const exactAliasMatches = uniqueFoods(
    activeFoods.filter((food) =>
      food.aliases.some((alias) => alias.normalizedAlias === normalizedLabel),
    ),
  );

  if (exactAliasMatches.length === 1) {
    const food = exactAliasMatches[0];

    if (!food) {
      return { status: "not_found" };
    }

    return {
      status: "matched",
      food,
      matchedName: getDisplayName(food),
    };
  }

  if (exactAliasMatches.length > 1) {
    return {
      status: "ambiguous",
      options: exactAliasMatches,
    };
  }

  const exactNameMatches = uniqueFoods(
    activeFoods.filter(
      (food) =>
        normalizeFoodText(food.nameEn) === normalizedLabel ||
        normalizeFoodText(food.nameRu) === normalizedLabel,
    ),
  );

  if (exactNameMatches.length === 1) {
    const food = exactNameMatches[0];

    if (!food) {
      return { status: "not_found" };
    }

    return {
      status: "matched",
      food,
      matchedName: getDisplayName(food),
    };
  }

  if (exactNameMatches.length > 1) {
    return {
      status: "ambiguous",
      options: exactNameMatches,
    };
  }

  const containsMatches = uniqueFoods(
    activeFoods.filter((food) =>
      getSearchTerms(food).some((term) => isSafeContainsMatch(normalizedLabel, term)),
    ),
  );

  if (containsMatches.length === 1) {
    const food = containsMatches[0];

    if (!food) {
      return { status: "not_found" };
    }

    return {
      status: "matched",
      food,
      matchedName: getDisplayName(food),
    };
  }

  if (containsMatches.length > 1) {
    return {
      status: "ambiguous",
      options: containsMatches,
    };
  }

  const tokenOrderMatches = uniqueFoods(
    activeFoods.filter((food) =>
      getSearchTerms(food).some((term) => isSafeTokenSubsetMatch(normalizedLabel, term)),
    ),
  );

  if (tokenOrderMatches.length === 1) {
    const food = tokenOrderMatches[0];

    if (!food) {
      return { status: "not_found" };
    }

    return {
      status: "matched",
      food,
      matchedName: getDisplayName(food),
    };
  }

  if (tokenOrderMatches.length > 1) {
    return {
      status: "ambiguous",
      options: tokenOrderMatches,
    };
  }

  return {
    status: "not_found",
  };
}

function getSearchTerms(food: NutritionFoodRecord): string[] {
  return [
    normalizeFoodText(food.nameEn),
    normalizeFoodText(food.nameRu),
    ...food.aliases.map((alias) => alias.normalizedAlias),
  ].filter((term) => term.length >= 3);
}

function isSafeContainsMatch(normalizedLabel: string, term: string): boolean {
  if (term.length < 3 || normalizedLabel.length < 3) {
    return false;
  }

  return normalizedLabel.includes(term) || term.includes(normalizedLabel);
}

function isSafeTokenSubsetMatch(normalizedLabel: string, term: string): boolean {
  const labelTokens = getMeaningfulTokens(normalizedLabel);
  const termTokens = getMeaningfulTokens(term);

  if (labelTokens.length < 2 || termTokens.length < 2) {
    return false;
  }

  const labelTokenSet = new Set(labelTokens);
  const termTokenSet = new Set(termTokens);

  return (
    termTokens.every((token) => labelTokenSet.has(token)) ||
    labelTokens.every((token) => termTokenSet.has(token))
  );
}

function getMeaningfulTokens(value: string): string[] {
  return normalizeFoodText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function uniqueFoods(foods: NutritionFoodRecord[]): NutritionFoodRecord[] {
  const seen = new Set<string>();
  const result: NutritionFoodRecord[] = [];

  for (const food of foods) {
    if (!seen.has(food.id)) {
      seen.add(food.id);
      result.push(food);
    }
  }

  return result;
}

function getDisplayName(food: NutritionFoodRecord): string {
  return food.nameEn;
}
