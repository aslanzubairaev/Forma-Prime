import type { Bot } from "grammy";

import { resetConversationState } from "../../conversation/conversation-state.service.js";
import { normalizeLanguage, t } from "../../i18n/index.js";
import { getProfileByUserId } from "../../onboarding/onboarding.service.js";
import { upsertTelegramUser } from "../../users/user.service.js";
import { replyWithMainMenu } from "../menu.js";
import { beginOrResumeOnboarding } from "../onboarding.js";

export function registerStartCommand(bot: Bot): void {
  bot.command("start", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply(t("en", "common.missingTelegramUser"));
      return;
    }

    const user = await upsertTelegramUser(ctx.from);
    const profile = await getProfileByUserId(user.id);
    const language = normalizeLanguage(
      profile?.preferredLanguage ?? user.languageCode,
    );

    if (!profile?.onboardingCompletedAt) {
      await beginOrResumeOnboarding(ctx, user.id, language);
      return;
    }

    await resetConversationState(user.id);
    await ctx.reply(t(language, "start.welcomeBack"));
    await replyWithMainMenu(ctx, language);
  });
}
