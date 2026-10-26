// Shared by the requests page and the history server action (a "use server" file
// can only export async functions, so these live here).

// item_requests has two links to profiles (requester and reviewer), so each join names its column.
export const REQUEST_COLUMNS =
  "id, queue_number, items, team_members, details, created_at, status, reviewed_at, admin_note, requester:profiles!user_id(full_name, email), reviewer:profiles!reviewed_by(full_name, email)";

// Reviewed requests shown per page of history, well under the API's row limit.
export const HISTORY_PAGE_SIZE = 50;

// Where the next page of history starts: just after this request, in the history's
// order (most recently reviewed first, then by id, so requests reviewed at the same
// moment never get skipped or repeated between pages).
export type HistoryCursor = { reviewedAt: string | null; id: string };
