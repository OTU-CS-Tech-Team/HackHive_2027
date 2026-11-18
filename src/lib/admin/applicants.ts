type Row = { id: string; submitted_at: string | null };
type Page<T> = { data: T[] | null; error: unknown };

// Keyset paging on id: rows inserted mid-load can't shift the pages, so nobody
// is duplicated or skipped. Stops on an empty page, so a server cap lower than
// the page size can't end the loop early.
export async function loadAllByKeyset<T extends Row>(fetchPage: (afterId: string | null) => PromiseLike<Page<T>>) {
  const data: T[] = [];
  for (let afterId: string | null = null; ;) {
    const { data: page, error } = await fetchPage(afterId);
    if (error || !page) return { data: null, error: error ?? new Error("No data") };
    if (page.length === 0) return { data: data.sort(bySubmittedAt), error: null };
    data.push(...page);
    afterId = page[page.length - 1].id;
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
