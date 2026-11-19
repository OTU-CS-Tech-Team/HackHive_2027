import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { createOpenAIGrader, hiveModel } from "./grader";
import { scoreApplication, type HiveDeps } from "./score";

export function hiveDeps(): HiveDeps {
  const model = hiveModel();
  return { db: createServiceClient(), grade: createOpenAIGrader(model), model };
}

/** For after(): grades one applicant and never throws, so it can't affect the request. */
export async function scoreInBackground(applicationId: string) {
  try {
    const result = await scoreApplication(applicationId, hiveDeps());
    if (!result.ok) console.error("Hive Mind scoring failed:", applicationId, result.error);
  } catch (error) {
    console.error("Hive Mind scoring error:", applicationId, error);
  }
}
