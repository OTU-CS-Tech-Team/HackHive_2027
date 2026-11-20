// How long after a "finish your application" reminder goes out before the next one
// can, so pressing "Email drafts" twice, or two admins at once, doesn't email the
// same applicants again. Checked on the server (startDraftReminderRun) and shown as
// a countdown on the admin Drafts tab.
export const REMINDER_COOLDOWN_HOURS = 24;
export const REMINDER_COOLDOWN_MS = REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;

// When the next reminder can go out, given when the last one started (null if none
// has gone out yet), in milliseconds since the epoch.
export function nextReminderAt(lastStartedAt: string | null | undefined): number | null {
  return lastStartedAt ? Date.parse(lastStartedAt) + REMINDER_COOLDOWN_MS : null;
}
