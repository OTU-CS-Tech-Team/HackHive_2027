import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { HiveQuotaError } from "./errors";
import { HiveGradeSchema, SYSTEM_PROMPT, formatAnswers } from "./prompt";
import type { Grader } from "./score";

// Kept free of server-only imports so scripts/hive-eval.ts can use the exact
// same call. The app only reaches it through src/lib/hive/openai.ts.

export const hiveModel = () => process.env.HIVE_MODEL || "gpt-6.1-sol";

// Worst case per applicant is about 2 x 20s plus a short backoff, so a batch of
// 5 run side by side (and the single after() call on submit) finishes well
// inside the routes' 60s maxDuration.
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 1;

/** Grades with OpenAI's Responses API and a strict JSON schema. Reads OPENAI_API_KEY. */
export function createOpenAIGrader(model = hiveModel()): Grader {
  const client = new OpenAI({ timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
  return async (input) => {
    try {
      const response = await client.responses.create({
        model,
        instructions: SYSTEM_PROMPT,
        input: formatAnswers(input),
        text: { format: zodTextFormat(HiveGradeSchema, "hive_grade") },
        // Low effort keeps grading quick, cheap and consistent.
        reasoning: { effort: "low" },
        store: false,
      });
      return response.output_text;
    } catch (error) {
      if (error instanceof OpenAI.APIError && error.code === "insufficient_quota") throw new HiveQuotaError();
      throw error;
    }
  };
}
