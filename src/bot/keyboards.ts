import { InlineKeyboard } from "grammy";

export const menuAction = {
  nutrition: "menu:nutrition",
  workout: "menu:workout",
  checkin: "menu:checkin",
  profile: "menu:profile",
  help: "menu:help",
} as const;

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Nutrition", menuAction.nutrition)
    .text("Workout", menuAction.workout)
    .row()
    .text("Bodyweight", menuAction.checkin)
    .text("Profile", menuAction.profile)
    .row()
    .text("Help", menuAction.help);
}
