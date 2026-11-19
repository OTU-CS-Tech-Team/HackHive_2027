import type { Application } from "@/lib/application/schema";
import type { HiveInput } from "./prompt";

// The only application fields the Hive Mind ever sees. Everything else (name,
// contact details, school, year, links, resume, team, demographics, logistics)
// stays on the server so grading is blind.
export const HIVE_INPUT_FIELDS = ["q_proud", "q_hack", "q_anything_else"] as const;

type Answers = Pick<Application, (typeof HIVE_INPUT_FIELDS)[number]>;

export function buildHiveInput(app: Answers): HiveInput {
  return {
    proud: app.q_proud?.trim() ?? "",
    hack: app.q_hack?.trim() ?? "",
    anything_else: app.q_anything_else?.trim() ?? "",
  };
}
