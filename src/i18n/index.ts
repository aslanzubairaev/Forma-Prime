import { en } from "./messages/en.js";
import { ru } from "./messages/ru.js";

export type SupportedLanguage = "en" | "ru";

const dictionaries = {
  en,
  ru,
} as const;

const supportedLanguages = new Set<string>(Object.keys(dictionaries));

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return supportedLanguages.has(value);
}

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  if (!value) {
    return "en";
  }

  const language = value.toLowerCase().split("-")[0] ?? "en";
  return isSupportedLanguage(language) ? language : "en";
}

export function t(
  language: string | null | undefined,
  key: keyof typeof en,
  params: Record<string, string | number> = {},
): string {
  const normalizedLanguage = normalizeLanguage(language);
  const template = dictionaries[normalizedLanguage][key] ?? dictionaries.en[key];

  return Object.entries(params).reduce(
    (message, [paramKey, value]) =>
      message.replaceAll(`{${paramKey}}`, String(value)),
    template,
  );
}
