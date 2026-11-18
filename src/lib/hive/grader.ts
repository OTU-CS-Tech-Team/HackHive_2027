import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { HiveGradeSchema, SYSTEM_PROMPT, formatAnswers } from "./prompt";
import type { Grader } from "./score";

// Kept free of server-only imports so scripts/hive-eval.ts can use the exact
// same call. The app only reaches it through src/lib/hive/openai.ts.

export const hiveModel = () => process.env.HIVE_MODEL || "gpt-6.1-sol";

/** Grades with OpenAI's Responses API and a strict JSON schema. Reads OPENAI_API_KEY. */
export function createOpenAIGrader(model = hiveModel()): Grader {
  const client = new OpenAI({ timeout: 45_000, maxRetries: 2 });
  return async (input) => {
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
  };
}
