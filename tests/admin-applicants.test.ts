import { describe, expect, it } from 'vitest';
import { bySubmittedAt, loadAllByKeyset } from '../src/lib/admin/applicants';

type Row = { id: string; submitted_at: string | null };

const row = (id: string, submitted_at: string | null = null): Row => ({ id, submitted_at });

// Serves rows after a given id, in id order, like .order("id").gt("id", afterId).limit(size).
function pager(rows: Row[], size: number, onPage?: (afterId: string | null) => void) {
  return async (afterId: string | null) => {
    onPage?.(afterId);
    const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
    return { data: sorted.filter((r) => afterId === null || r.id > afterId).slice(0, size), error: null };
  };
}

describe('loadAllByKeyset', () => {
  it('pages on the last id seen and stops on an empty page', async () => {
    const seen: (string | null)[] = [];
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => row(id));

    const { data } = await loadAllByKeyset(pager(rows, 2, (afterId) => seen.push(afterId)));

    expect(seen).toEqual([null, 'b', 'd', 'e']);
    expect(data?.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it("doesn't duplicate or skip anyone when someone submits mid-load", async () => {
    const rows = [row('b', '2026-11-01T00:00:00Z'), row('d'), row('f')];
    const page = pager(rows, 1);
    let calls = 0;

    const { data } = await loadAllByKeyset(async (afterId) => {
      // A new applicant lands before the cursor after the first page.
      if (++calls === 2) rows.push(row('a', '2026-11-02T00:00:00Z'));
      return page(afterId);
    });

    expect(data?.map((r) => r.id)).toEqual(['b', 'd', 'f']);
  });

  it('returns the error when a page fails', async () => {
    const error = new Error('boom');
    let calls = 0;

    const result = await loadAllByKeyset(async () => (++calls === 1 ? { data: [row('a')], error: null } : { data: null, error }));

    expect(result).toEqual({ data: null, error });
  });
});

describe('bySubmittedAt', () => {
  it('puts the oldest submission first, drafts last, and breaks ties by id', () => {
    const rows = [
      row('e'),
      row('d', '2026-11-03T00:00:00Z'),
      row('c', '2026-11-01T00:00:00Z'),
      row('a'),
      row('b', '2026-11-01T00:00:00Z'),
    ];

    expect(rows.sort(bySubmittedAt).map((r) => r.id)).toEqual(['b', 'c', 'd', 'a', 'e']);
  });
});
