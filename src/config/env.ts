import "dotenv/config";

import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  BOT_TOKEN: z.string().trim().min(1, "BOT_TOKEN is required"),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
  DIRECT_URL: optionalNonEmptyString,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_FOOD_DRAFT_MODEL: z.string().trim().min(1).default("gpt-4.1-mini"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = loadEnv(process.env);
