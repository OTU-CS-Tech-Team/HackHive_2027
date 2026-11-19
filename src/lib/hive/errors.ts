// Saved as the score's error when OpenAI says the account is out of credits, so
// the admin page can spot it (see creditsRunOut in view.ts).
export const QUOTA_ERROR = "OpenAI credits are used up (insufficient_quota). Top up the account, then score again.";

/** The grader throws this when retrying can't help until someone adds credits. */
export class HiveQuotaError extends Error {
  constructor() {
    super(QUOTA_ERROR);
    this.name = "HiveQuotaError";
  }
}
