type Row = { id: string; submitted_at: string | null };
type Page<T> = { data: T[] | null; error: unknown };

// Keyset paging (Supabase returns at most 1000 rows per query): rows inserted
// mid-load can't shift the pages, so nobody is duplicated or skipped. Stops on
// an empty page, so a server cap lower than the page size can't end the loop
// early. Any failed page fails the whole load, never a partial list.
// `key` is the column the pages are ordered by (default id); the cursor is its
// last value as a string. `sort` orders the result, e.g. bySubmittedAt.
export async function loadAllByKeyset<T extends object>(
  fetchPage: (after: string | null) => PromiseLike<Page<T>>,
  { key = "id" as keyof T, sort }: { key?: keyof T; sort?: (a: T, b: T) => number } = {},
): Promise<{ data: T[]; error: null } | { data: null; error: unknown }> {
  const data: T[] = [];
  for (let after: string | null = null; ;) {
    const { data: page, error } = await fetchPage(after);
    if (error || !page) return { data: null, error: error ?? new Error("No data") };
    if (page.length === 0) return { data: sort ? data.sort(sort) : data, error: null };
    data.push(...page);
    after = String(page[page.length - 1][key]);
  }
}

// Oldest submission first, drafts (no submitted_at) last, id breaks ties.
// Matches Postgres: uuids compare as lowercase hex, so plain string order works.
export function bySubmittedAt(a: Row, b: Row) {
  if (a.submitted_at !== b.submitted_at) {
    if (a.submitted_at === null) return 1;
    if (b.submitted_at === null) return -1;
    const diff = Date.parse(a.submitted_at) - Date.parse(b.submitted_at);
    if (diff) return diff;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
