import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_FOOD_DRAFT_MODEL: z.string().default("gpt-4.1-mini"),
});

export const env = envSchema.parse(process.env);
