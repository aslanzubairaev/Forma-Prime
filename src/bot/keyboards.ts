import { InlineKeyboard } from "grammy";

import { t, type SupportedLanguage } from "../i18n/index.js";

export const menuAction = {
  nutrition: "menu:nutrition",
  workout: "menu:workout",
  checkin: "menu:checkin",
  profile: "menu:profile",
  help: "menu:help",
} as const;

export function mainMenuKeyboard(language: SupportedLanguage): InlineKeyboard {
  return new InlineKeyboard()
    .text(t(language, "menu.button.nutrition"), menuAction.nutrition)
    .text(t(language, "menu.button.workout"), menuAction.workout)
    .row()
    .text(t(language, "menu.button.checkin"), menuAction.checkin)
    .text(t(language, "menu.button.profile"), menuAction.profile)
    .row()
    .text(t(language, "menu.button.help"), menuAction.help);
}
