export function normalizeFoodText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
